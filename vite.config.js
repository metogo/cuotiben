import { defineConfig, loadEnv } from 'vite';
import { notebookHandler } from './api/notebook.js';

const learningPaths = '^/api/(learning/|consent(?:$|[?])|providers(?:$|[?]))';
const localRoute = '/__learning_localhost';

export default defineConfig(({ mode }) => {
  const requesty = loadEnv(mode, process.cwd(), 'REQUESTY_');
  const learning = loadEnv(mode, process.cwd(), 'LEARNING_');
  const target = learning.LEARNING_SERVICE_ORIGIN || 'https://fudaozuoye.com';
  const alias = learning.LEARNING_LOCALHOST_SERVICE_ORIGIN;
  const proxy = { [learningPaths]: { target, changeOrigin: true } };
  if (alias)
    proxy[localRoute + '/api/'] = {
      target: alias,
      changeOrigin: true,
      rewrite: (path) => path.slice(localRoute.length),
    };
  const configure = (server) => {
    // Each loopback hostname keeps its own cookie, notebook and real upstream origin check.
    if (alias)
      server.middlewares.use((req, _res, next) => {
        if (req.headers.host?.split(':')[0] === 'localhost' && new RegExp(learningPaths).test(req.url))
          req.url = localRoute + req.url;
        next();
      });
    server.middlewares.use('/api/notebook', notebookHandler(requesty.REQUESTY_API_KEY));
  };
  return {
    plugins: [{ name: 'notebook-api', configureServer: configure, configurePreviewServer: configure }],
    server: { watch: { ignored: ['**/docs/**', '**/scripts/**', '**/tests/**'] }, proxy },
  };
});
