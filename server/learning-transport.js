import { lookup } from 'node:dns/promises';
import https from 'node:https';
import tls from 'node:tls';
import { Readable } from 'node:stream';

// The learning host advertises several addresses, and individual routes can
// stall from Vercel. Race only TLS handshakes. Send HTTP bytes over one socket.
class LearningAgent extends https.Agent {
  createConnection(options, done) {
    const host = options.hostname || options.host;
    const sockets = new Set();
    async function connect() {
      const addresses = await lookup(host, { all: true });
      return Promise.any(addresses.map(({ address, family }) => new Promise((resolve, reject) => {
        const socket = tls.connect({
          host: address, family, port: options.port, servername: host,
          rejectUnauthorized: true, ALPNProtocols: ['http/1.1'],
        });
        sockets.add(socket);
        const timer = setTimeout(() => socket.destroy(new Error('TLS connection timed out')), 5500);
        socket.once('close', () => clearTimeout(timer));
        socket.once('error', reject);
        socket.once('secureConnect', () => {
          clearTimeout(timer);
          resolve(socket);
        });
      })));
    }
    connect().then(socket => {
      sockets.delete(socket);
      for (const other of sockets) other.destroy();
      done(null, socket);
    }, error => {
      for (const socket of sockets) socket.destroy();
      done(Object.assign(new Error('Unable to establish upstream TLS', { cause: error }), { code: 'LEARNING_DIAL_FAILED' }));
    });
  }
}

const agent = new LearningAgent({ keepAlive: true, maxFreeSockets: 4 });
export function learningRequest(url, method, headers, body, signal) {
  return new Promise((resolve, reject) => {
    const outgoing = https.request(url, { agent, method, headers, signal }, incoming => {
      resolve({
        status: incoming.statusCode, headers: incoming.headers,
        body: Readable.toWeb(incoming),
      });
    });
    outgoing.once('error', reject);
    outgoing.end(body);
  });
}
