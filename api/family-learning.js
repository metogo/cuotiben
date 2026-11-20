import { learningRequest } from '../server/learning-transport.js';

// Both addresses serve the same learning API, including its signed session cookies.
const gateways = [
  'https://mini-0324-100046523669-03b06729f-1406836756.ap-shanghai.app.tcloudbase.com/api/',
  'https://fudaozuoye.com/api/',
];
const operations = new Set(['consent', 'providers', 'learning/question-entry', 'learning/analyze', 'learning/tutor', 'learning/solution']);
const notebookOrigin = 'https://cuotiben-orpin.vercel.app';
const qaOrigin = 'https://cuotiben-qa-xiaoweis-projects-cf1fe430.vercel.app';

async function forward(request, path, headers) {
  const handshake = path === 'consent' || path === 'providers';
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(handshake ? 15000 : 175000)]);
  const body = request.method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined;
  if (body) headers['content-length'] = String(body.byteLength);
  try {
    return await learningRequest(gateways[0] + path, request.method, headers, body, signal);
  } catch (error) {
    // This error originates exclusively before HTTP is sent, so retrying this
    // connection cannot resubmit a question that a model has already received.
    if (signal.aborted || error.code !== 'LEARNING_DIAL_FAILED') throw error;
    console.info('Learning gateway reconnect', process.env.VERCEL_REGION, path, error.cause?.errors?.map(e => e.code || e.message));
    return learningRequest(gateways[1] + path, request.method, headers, body, signal);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.searchParams.get('op');
    if (!operations.has(path)) return new Response(null, { status: 404 });
    if (request.method !== (path === 'providers' ? 'GET' : 'POST')) return new Response(null, { status: 405 });
    const origin = request.headers.get('origin');
    if (request.method === 'POST') {
      // The fixed QA alias also validates a staged production build before promotion.
      if (origin !== url.origin || (origin !== notebookOrigin && origin !== qaOrigin)) {
        return Response.json({ message: '请从当前错题本网页发起请求。' }, { status: 403 });
      }
    }
    const headers = {};
    for (const key of ['origin', 'accept', 'content-type']) {
      if (request.headers.has(key)) headers[key] = request.headers.get(key);
    }
    const consent = request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('guardian_consent_v1='));
    if (consent) headers.cookie = consent;
    try {
      const upstream = await forward(request, path, headers);
      const responseHeaders = new Headers({ 'cache-control': 'no-store, no-transform' });
      if (process.env.VERCEL_REGION) responseHeaders.set('x-learning-region', process.env.VERCEL_REGION);
      if (upstream.headers['content-type']) responseHeaders.set('content-type', upstream.headers['content-type']);
      if (path === 'consent') {
        for (const value of upstream.headers['set-cookie'] || []) {
          if (value.startsWith('guardian_consent_v1=')) responseHeaders.append('set-cookie', value);
        }
      }
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (error) {
      console.error('Learning gateway request failed', process.env.VERCEL_REGION, path, error.code || error.name,
        error.cause?.errors?.map(e => e.code || e.message));
      return Response.json({ message: '暂时连不上辅导服务，请稍后重试。' }, { status: 502 });
    }
  },
};
