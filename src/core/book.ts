export interface Attempt {
  id: string;
  answer: string;
  paper: boolean;
  ink?: { strokes: [number, number][][]; autoTypeset?: boolean; proposedText?: string; transcript: string; transcriptNeedsReview?: boolean };
  correct: boolean;
  date: number;
}
export interface Lesson {
  hint: string;
  steps: string[];
  check: string;
  provider: string;
  modelId: string;
}
export interface Question {
  id: string;
  date: number;
  q: string;
  child: string;
  teacher: string;
  subject?: string;
  source: string;
  img: string;
  attempts: Attempt[];
  lesson: Lesson;
}
type StoredQuestion = Omit<Question, 'img'> & { img: Blob | string };
async function forDisplay(row: StoredQuestion): Promise<Question> {
  if (typeof row.img === 'string') return { ...row, img: row.img };
  const photo = row.img;
  const img = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error('本机无法读取这道题的选区。'));
    reader.readAsDataURL(photo);
  });
  return { ...row, img };
}
type Summary = Pick<Question, 'id' | 'date' | 'q' | 'source' | 'subject'> & { isCorrected: boolean; mistakeCount: number };
export function countMistakes(attempts: Attempt[] = []): number {
  return 1 + attempts.filter(attempt => attempt.correct === false).length;
}
export function corrected(row: { attempts?: Attempt[]; isCorrected?: boolean }): boolean {
  return row.isCorrected ?? row.attempts?.at(-1)?.correct === true;
}
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('shiti-family-live', 1);
      request.onupgradeneeded = () => {
        for (const name of ['questions', 'list']) request.result.createObjectStore(name, { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}
function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function list(): Promise<Summary[]> {
  const db = await database();
  const tx = db.transaction(['list', 'questions'], 'readwrite');
  const index = tx.objectStore('list');
  const summaries = await read<Summary[]>(index.getAll());
  // Backfill legacy list entries once, using the history in the same transaction.
  const rows = await Promise.all(summaries.map(async row => {
    if (typeof row.mistakeCount === 'number') return row;
    const question = await read<StoredQuestion>(tx.objectStore('questions').get(row.id));
    const summary = { ...row, mistakeCount: countMistakes(question.attempts) };
    await read(index.put(summary));
    return summary;
  }));
  return rows.sort((a, b) => b.date - a.date);
}
export async function get(id: string): Promise<Question> {
  const db = await database();
  const row = await read<StoredQuestion | undefined>(db.transaction('questions').objectStore('questions').get(id));
  if (!row) throw Error('这道题已移除，请返回错题本。');
  return forDisplay(row);
}
function update(
  id: string,
  change: (previous?: StoredQuestion) => StoredQuestion | undefined,
): Promise<StoredQuestion | undefined> {
  return database().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(['questions', 'list'], 'readwrite');
        const questions = tx.objectStore('questions'),
          summaries = tx.objectStore('list');
        let result: StoredQuestion | undefined, cause: unknown;
        const request = questions.get(id);
        request.onsuccess = () => {
          try {
            result = change(request.result);
            if (result === request.result) return;
            if (!result) {
              questions.delete(id);
              summaries.delete(id);
              return;
            }
            const { date, q, source } = result;
            questions.put(result);
            summaries.put({
              id,
              date,
              q: Array.from(q).slice(0, 180).join(''),
              source,
              subject: result.subject,
              isCorrected: corrected(result),
              mistakeCount: countMistakes(result.attempts),
            });
          } catch (error) {
            cause = error;
            tx.abort();
          }
        };
        tx.onabort = () => {
          const error = cause || tx.error;
          reject(
            error instanceof DOMException && error.name === 'QuotaExceededError'
              ? Error('浏览器存储空间不足。请先释放设备空间，再回来重试，之前收好的题仍在。')
              : error || Error('本地写入中断，请重试。'),
          );
        };
        tx.oncomplete = () => {
          window.dispatchEvent(new Event('bookchange'));
          bus?.postMessage('refresh');
          resolve(result);
        };
      }),
  );
}
const bus = typeof window === 'undefined' || !window.BroadcastChannel ? null : new BroadcastChannel('shiti-book');
if (bus) bus.onmessage = () => window.dispatchEvent(new Event('bookchange'));
export function saveQuestion(q: Question) {
  if (
    !q.lesson?.modelId ||
    !['doubao', 'requesty'].includes(q.lesson.provider) ||
    !q.lesson.hint?.trim() ||
    !q.lesson.steps?.length ||
    !q.lesson.check?.trim()
  )
    throw Error('请先取得真实模型的完整解析。');
  return storeQuestion(q);
}
async function storeQuestion(q: Question) {
  // Keep existing string records readable. New photos occupy one binary object.
  let photo: Blob | string = q.img;
  if (photo) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(photo)) throw Error('本题选区格式无效，请重新圈题。');
    photo = await (await fetch(photo)).blob();
  }
  await update(q.id, (old) => old || { ...q, img: photo });
}
export function saveAttempt(id: string, attempt: Attempt) {
  return update(id, (old) => {
    if (!old) throw Error('这道题已移除，请返回错题本。');
    const attempts = old.attempts || [];
    if (attempts.some((a) => a.id === attempt.id)) return old;
    return { ...old, attempts: [...attempts, attempt] };
  }).then((row) => forDisplay(row!));
}
export function remove(id: string) {
  return update(id, () => undefined);
}

export async function changeSubject(id: string, subject: string): Promise<void> {
  await update(id, (row) => {
    if (!row) throw Error('这道题已移除，请返回错题本。');
    return { ...row, subject };
  });
}
