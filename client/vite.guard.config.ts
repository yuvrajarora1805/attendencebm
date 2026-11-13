import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const guardPort = parseInt(process.env.GUARD_PORT || env.GUARD_PORT || '5174', 10);
  const backendPort = parseInt(process.env.PORT || env.VITE_BACKEND_PORT || '5050', 10);

  return {
    plugins: [react()],
    server: {
      port: guardPort,
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
