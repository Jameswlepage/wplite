import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(
      __dirname,
      '../generated/wp-content/plugins/portfolio-light-app/build'
    ),
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
