import { once } from 'node:events';
import { generate, ServiceError } from '../server/requesty.js';
import { models } from '../shared/models.js';

async function readInput(req) {
  if (!String(req.headers['content-type']).startsWith('application/json'))
    throw new ServiceError(415, '请使用网页提交题目。');
  let raw = req.body;
  if (raw === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 64000) throw new ServiceError(413, '本题文字太长。');
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString();
  }
  if (Buffer.byteLength(typeof raw === 'string' ? raw : JSON.stringify(raw)) > 64000)
    throw new ServiceError(413, '本题文字太长。');
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ServiceError(400, '题目提交格式有误。');
  }
}
function frame(event, value) {
  return 'event: ' + event + '\ndata: ' + JSON.stringify(value) + '\n\n';
}
export function notebookHandler(key, timeoutMs = 120000) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    if (req.method === 'GET') return send(200, { models: key ? models : [] });
    if (req.method !== 'POST') return send(405, { message: '请求方式不受支持。' });
    const origin = req.headers.origin;
    try {
      if (!origin || !['http://' + req.headers.host, 'https://' + req.headers.host].includes(origin))
        throw new ServiceError(403, '请从当前网页发起解析。');
      const body = await readInput(req);
      const controller = new AbortController();
      const abort = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.once('close', abort);
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
        const streaming = req.headers.accept?.includes('text/event-stream');
        function startStream() {
          if (res.headersSent) return;
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders();
        }
        const onDelta = streaming ? async (text) => {
          signal.throwIfAborted();
          startStream();
          if (!res.write(frame('delta', { text }))) await once(res, 'drain', { signal });
        } : undefined;
        const { lesson } = await generate(key, body, signal, onDelta);
        if (res.destroyed) return;
        if (streaming) {
          startStream();
          res.end(frame('complete', lesson));
        } else send(200, lesson);
      } finally {
        res.off('close', abort);
      }
    } catch (error) {
      if (res.destroyed) return;
      const message = error instanceof ServiceError ? error.message : '模型连接中断或超时，原稿已保留。';
      if (res.headersSent) res.end(frame('error', { message }));
      else send(error.status || 502, { message });
    }
  };
}
export default function handler(req, res) {
  return notebookHandler(process.env.REQUESTY_API_KEY, 55000)(req, res);
}
