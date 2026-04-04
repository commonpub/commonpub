import { defineConfig } from 'histoire';
import { HstVue } from '@histoire/plugin-vue';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [HstVue()],
  setupFile: './stories/setup.ts',
  storyMatch: ['./stories/**/*.story.vue'],
  tree: {
    groups: [
      { id: 'blocks', title: 'Block Components' },
      { id: 'composites', title: 'Composite Components' },
    ],
  },
  theme: {
    title: '@commonpub/explainer',
    favicon: '',
  },
  vite: {
    plugins: [vue()],
    resolve: {
      alias: {
        '@commonpub/explainer': new URL('./src/index.ts', import.meta.url).pathname,
      },
    },
  },
});
