import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const outDir = process.env.WPLITE_ADMIN_OUT_DIR;
if (!outDir) {
  throw new Error('WPLITE_ADMIN_OUT_DIR environment variable is required.');
}

const devHost = process.env.WPLITE_ADMIN_DEV_HOST || '127.0.0.1';
const devPort = Number(process.env.WPLITE_ADMIN_DEV_PORT || 5273);
const devOrigin = `http://${devHost}:${devPort}`;

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
    cors: true,
    origin: devOrigin,
    hmr: { host: devHost, port: devPort, protocol: 'ws' },
  },
  build: {
    outDir: path.resolve(outDir),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, './src/main.jsx'),
      output: {
        entryFileNames: 'admin-app.js',
        assetFileNames: ({ name }) => {
          if (name === 'style.css') {
            return 'admin-app.css';
          }

          return 'assets/[name]-[hash][extname]';
        },
        inlineDynamicImports: true,
      },
    },
  },
});
