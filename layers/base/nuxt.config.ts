import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiTheme = (file: string) => resolve(__dirname, '../../packages/ui/theme', file);

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
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
    uiTheme('components.css'),
    uiTheme('prose.css'),
    uiTheme('layouts.css'),
    uiTheme('forms.css'),
    uiTheme('editor-panels.css'),
  ],
  runtimeConfig: {
    databaseUrl: '',
    authSecret: 'dev-secret-change-me',
    emailAdapter: 'console',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    resendApiKey: '',
    resendFrom: '',
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3Endpoint: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3PublicUrl: '',
    uploadDir: './uploads',
    public: {
      siteUrl: 'http://localhost:3000',
      domain: 'localhost:3000',
      siteName: 'CommonPub',
      siteDescription: 'A CommonPub instance',
      features: {
        content: true,
        social: true,
        hubs: true,
        docs: true,
        video: true,
        contests: false,
        learning: true,
        explainers: true,
        federation: false,
        federateHubs: false,
        admin: false,
      },
      contentTypes: 'project,article,blog,explainer',
      contestCreation: 'admin',
    },
  },
  routeRules: {
    ...(process.env.NUXT_PUBLIC_FEATURES_DOCS !== 'false' && {
      '/docs/**': { prerender: true },
    }),
  },
  nitro: {
    preset: 'node-server',
  },
});
