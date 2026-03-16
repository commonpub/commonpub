import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiTheme = (file: string) => resolve(__dirname, '../../packages/ui/theme', file);

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
          crossorigin: 'anonymous',
        },
      ],
    },
  },
  css: [
    uiTheme('base.css'),
    uiTheme('dark.css'),
    uiTheme('prose.css'),
    uiTheme('layouts.css'),
    uiTheme('forms.css'),
    uiTheme('editor-panels.css'),
  ],
  modules: [],
  runtimeConfig: {
    databaseUrl: '',
    authSecret: 'dev-secret-change-me',
    public: {
      siteUrl: 'http://localhost:3000',
      domain: 'localhost:3000',
      siteName: 'CommonPub',
      siteDescription: 'A CommonPub instance',
    },
  },
  routeRules: {
    '/docs/**': { prerender: true },
  },
  nitro: {
    preset: 'node-server',
  },
  vite: {
    server: {
      fs: {
        allow: ['../..'],
      },
    },
  },
});
