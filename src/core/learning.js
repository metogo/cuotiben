import { subjectKey } from '../../shared/subjects.js';
import { readSSE } from '../../shared/sse.js';
import { lessonPreview } from './lessonPreview.js';
import { sections } from './solution.js';
// The upstream service owns guardian consent, daily admission, model selection and inference.
const notebookOrigins = new Set([
  'https://cuotiben-orpin.vercel.app',
  'https://cuotiben-qa-xiaoweis-projects-cf1fe430.vercel.app',
]);
const direct = notebookOrigins.has(globalThis.location?.origin);
const learningApi = direct
  ? 'https://mini-0324-100046523669-03b06729f-1406836756.ap-shanghai.app.tcloudbase.com/api'
  : '/api';
const options = { cache: 'no-store' };
let session;

async function learningFetch(path, init) {
  if (path === '/notebook') return fetch('/api/notebook', { ...init, credentials: 'same-origin' });
  const headers = new Headers(init.headers);
  if (direct && path !== '/consent') {
    await consent(init.signal);
    headers.set('x-notebook-consent', session.token);
  }
  const suffix = direct && path === '/consent' ? '?client=notebook' : '';
  return fetch(learningApi + path + suffix, { ...init, headers, credentials: direct ? 'omit' : 'same-origin' });
}

async function verify(response) {
  if (response.ok) return response;
  const raw = await response.text();
  let message;
  try {
    const body = JSON.parse(raw);
    message = body.error?.message || body.message;
  } catch {
    message = raw.startsWith('<') ? '模型网关暂时不可用。' : raw;
  }
  if (message === '请求来源不合法') {
    throw Error('辅导作业服务还未允许当前网页地址。本次请求未到达豆包，请联系页面提供方核对访问地址后重试。');
  }
  throw Error((message || '辅导作业服务暂时无法响应。').slice(0, 220));
}
async function post(path, body, signal, accept = 'application/json') {
  return verify(
    await learningFetch(path, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: accept },
      body: JSON.stringify(body),
      signal,
    }),
  );
}
export async function consent(signal) {
  if (direct && session && session.expiresAt - Date.now() > 180000) return;
  const body = await (await post('/consent', {}, signal)).json();
  if (!body.accepted || !body.providers?.some((p) => p.id === 'doubao' && p.available && p.mode === 'live')) {
    throw Error('当前没有可用的真实模型。本次作业尚未发送。');
  }
  if (direct) {
    const next = body.notebookSession;
    if (!next?.token || !Number.isFinite(next.expiresAt) || next.expiresAt <= Date.now())
      throw Error('没有取得有效的辅导会话，请重试。');
    session = next;
  }
}
function browserId() {
  const key = 'learning-browser-id-v1';
  const previous = localStorage.getItem(key);
  if (previous) return previous;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}
// HTML multipart text fields reach the service with CRLF line endings. Sign
// those same bytes so multiline passages and answer options retain their identity.
export function formText(text) {
  return text.trim().replace(/\r\n|[\r\n]/g, '\r\n');
}
export async function admit(input, entryId, signal) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(formText(input)) : await input.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const inputHash = Array.from(digest, (x) => x.toString(16).padStart(2, '0')).join('');
  const deviceId = navigator.locks
    ? await navigator.locks.request('learning-browser-identity', browserId)
    : browserId();
  const admission = await (await post('/learning/question-entry', { deviceId, entryId, inputHash }, signal)).json();
  if (!admission.entryTicket) throw Error('没有取得本次发题凭据，请重试。');
  return admission.entryTicket;
}
async function events(response, onEvent, provider = 'doubao') {
  await verify(response);
  let complete;
  for await (const { event, data } of readSSE(response)) {
    const payload = JSON.parse(data);
    if (event === 'error') throw Error(payload.message || '模型未完成这次分析。');
    if (event === 'complete') { complete = payload; break; }
    onEvent(event, payload);
  }
  if (complete?.provider !== provider || !complete.modelId) throw Error('分析流未完整结束，原稿已保留。');
  return complete;
}
async function analyze(stage, ticket, values, signal) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    stage,
    provider: 'doubao',
    reasoningLevel: 'light',
    entryTicket: ticket,
    ...values,
  }))
    form.append(key, value);
  let result;
  const complete = await events(
    await learningFetch('/learning/analyze', { ...options, method: 'POST', body: form, signal }),
    (name, data) => {
      if (name === 'recognized' || name === 'graph') result = data;
    },
  );
  if (complete.mode !== 'live' || !result) throw Error('服务未提供真实推理结果。');
  return result;
}
export async function recognizePhoto(blob, entryId, signal) {
  const ticket = await admit(blob, entryId, signal);
  const problem = await analyze('recognize', ticket, { image: blob }, signal);
  if (!problem.text?.trim()) throw Error('没有读到完整题干，请重新圈题。');
  return { problem, photoAdmission: { ticket } };
}
export async function recognizeInk(blob, entryId, signal) {
  const ticket = await admit(blob, entryId, signal);
  const result = await analyze('recognize', ticket, { image: blob }, signal);
  if (result.missingVisualInformation?.length || result.visualContext?.facts?.length)
    throw Error('这页包含图形或位置关系，已保留手写布局。');
  const text = result.childWork?.trim() || result.text?.trim();
  if (!text) throw Error('没有识别出文字，可以保留原稿或重试。');
  return text;
}
async function modelText(path, body, signal, publish) {
  let text = '';
  const complete = await events(await post(path, body, signal, 'text/event-stream'), (name, data) => {
    if (name === 'reset') text = '';
    else if (name === 'delta' && typeof data.text === 'string') text += data.text;
    else return;
    publish(text);
  });
  if (!text.trim()) throw Error('模型没有返回讲解内容，请重试。');
  return { text: text.trim(), modelId: complete.modelId };
}
export async function generateLesson(draft, submission, signal, progress, publish) {
  const q = draft.q.trim();
  const samePhotoText = draft.photoAdmission && q === draft.recognizedText?.trim();
  if (samePhotoText && draft.problem?.missingVisualInformation?.length) {
    throw Error('这道题还缺少：' + draft.problem.missingVisualInformation.join('、') + '。请重新圈题或补齐文字。');
  }
  if (draft.model && draft.model !== 'doubao') {
    progress('正在请所选模型分析…');
    const response = await post('/notebook', { model: draft.model, q, child: draft.child }, signal, 'text/event-stream');
    let raw = '';
    const lesson = await events(response, (event, payload) => {
      if (event !== 'delta' || typeof payload.text !== 'string') return;
      raw += payload.text;
      publish(lessonPreview(raw));
    }, 'requesty');
    if (lesson.modelId !== draft.model) throw Error('讲解模型不符，请重试。');
    return lesson;
  }
  const photo = draft.photoAdmission;
  let problem = submission.problem || (samePhotoText ? draft.problem : undefined);
  let ticket = submission.ticket;
  if (!ticket && samePhotoText && (!photo.boundTo || photo.boundTo === submission.id)) {
    ticket = photo.ticket;
    photo.boundTo = submission.id;
  }
  if (!ticket) ticket = await admit(q, submission.id, signal);
  submission.ticket = ticket;
  if (!problem) {
    progress('正在读懂题目…');
    problem = await analyze('recognize_text', ticket, { text: formText(q) }, signal);
  }
  submission.problem = problem;
  if (problem.missingVisualInformation?.length) {
    throw Error('这道题还缺少：' + problem.missingVisualInformation.join('、') + '。请补齐后继续。');
  }
  // Keep the recognized evidence on the direct photo path. Edited questions carry their revised text.
  const confirmed = { ...problem, visualContext: samePhotoText ? problem.visualContext : undefined,
    text: q, childWork: draft.child.trim(), userRevised: !samePhotoText };

  progress('正在分析解题步骤…');
  const graph = await analyze('full', ticket, { problem: JSON.stringify(confirmed) }, signal);
  if (!graph.stateToken) throw Error('模型会话未建立。');
  const stateToken = graph.stateToken;
  const answer = draft.child.trim();
  const answerOnly = /^(?:[A-DＡ-Ｄ]|[-+]?\d+(?:[./]\d+)?(?:\s*[\p{L}%°]+){0,2})[。.!！]?$/iu.test(answer);
  let question = '请只教我下一步能动笔做什么。从一个具体条件开头，最后只问一个问题，让我自己动笔；不公布答案。';
  if (answerOnly)
    question =
      '这里只有最终作答「' +
      answer.slice(0, 90) +
      '」，完全没有我的做题过程。先请我说说或写下怎样得到这个答案，只围绕这一个追问，暂不分析错因或给出解法。';
  else if (answer)
    question =
      '请先判断原作答是否写了过程。若只有一个结论、词语或阅读题答案，只问我是怎样得到它的。若写了过程，保留其中有依据的步骤，引用最早能确认的卡点，只问一个能接着写的问题。允许不同解法，不猜错因，不公布答案。';
  question = '先核对本题能否只靠已给的题干与图中条件回答。若缺少决定答案的图、阅读材料或数值，请只回复“需补材料：”和具体缺项；信息足够时，' + question;
  progress('正在生成第一条提示…');
  const hint = await modelText('/learning/tutor', { stateToken, scope: { kind: 'problem' }, question }, signal,
    text => publish({ hint: text, detail: '' }));
  const missing = hint.text.trim().match(/^(?:\*\*)?需补材料(?:\*\*)?\s*[：:]\s*(?:\*\*)?([\s\S]+)/u);
  if (missing) throw Error('请补齐题目材料：' + missing[1].trim());
  progress('正在整理完整解析…');
  const solution = await modelText('/learning/solution', { stateToken }, signal,
    detail => publish({ hint: hint.text, detail }));
  return { hint: hint.text, ...sections(solution.text), subject: subjectKey(problem.subject), provider: 'doubao', modelId: solution.modelId };
}
