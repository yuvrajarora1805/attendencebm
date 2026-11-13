import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientPort = parseInt(process.env.CLIENT_PORT || env.PORT || '5173', 10);
  const backendPort = parseInt(process.env.PORT || env.VITE_BACKEND_PORT || '5050', 10);

  return {
    plugins: [react()],
    server: {
      port: clientPort,
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              if ((err as any).code === 'ECONNREFUSED') {
                // Backend is still spinning up - return 503 instead of flooding terminal with error stack trace
                if (res && 'writeHead' in res && !(res as any).headersSent) {
                  (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                  (res as any).end(JSON.stringify({ error: 'Backend server starting up, please wait...' }));
                }
              }
            });
          },
        },
      },
    },
  };
});
