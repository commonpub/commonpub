import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  resolve: {
    alias: {
      '@commonpub/editor': resolve(__dirname, '../src/index.ts'),
      '@commonpub/editor/vue': resolve(__dirname, '../vue/index.ts'),
      '@commonpub/schema': resolve(__dirname, '../../schema/src/index.ts'),
      '@commonpub/config': resolve(__dirname, '../../config/src/index.ts'),
    },
  },
  server: {
    port: 4201,
  },
});
