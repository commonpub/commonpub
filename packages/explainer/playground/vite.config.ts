import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  resolve: {
    alias: {
      '@commonpub/explainer': resolve(__dirname, '../src/index.ts'),
      '@commonpub/editor': resolve(__dirname, '../../editor/src/index.ts'),
    },
  },
  server: {
    port: 4200,
  },
});
