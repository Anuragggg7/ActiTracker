import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Backend target port MUST match PORT configured in backend/.env (default: http://localhost:5000)
const BACKEND_TARGET = 'http://localhost:5000';

const handleProxyError = (proxy, options) => {
  proxy.on('error', (err, req, res) => {
    console.error(`[Vite Proxy Error] Backend not reachable at ${options.target}. Make sure the backend server is running (npm run dev from project root).`);
  });
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Proxy /api requests to Express backend server
      '/api': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        configure: handleProxyError,
      },
      // Proxy static upload requests to Express backend server
      '/uploads': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        configure: handleProxyError,
      }
    }
  }
});
