import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const outDir = process.env.WPLITE_ADMIN_OUT_DIR;
if (!outDir) {
  throw new Error('WPLITE_ADMIN_OUT_DIR environment variable is required.');
}

export default defineConfig({
  plugins: [react()],
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
