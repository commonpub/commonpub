import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve theme CSS: use bundled ./theme/ (npm published) or monorepo path (dev)
const themeDir = existsSync(resolve(__dirname, 'theme'))
  ? resolve(__dirname, 'theme')
  : resolve(__dirname, '../../packages/ui/theme');
const uiTheme = (file: string) => resolve(themeDir, file);

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
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Work+Sans:ital,wght@0,300..800;1,300..800&display=swap',
        },
      ],
    },
  },
  css: [
    uiTheme('base.css'),
    uiTheme('dark.css'),
    uiTheme('generics.css'),
    uiTheme('agora.css'),
    uiTheme('agora-dark.css'),
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
        emailNotifications: false,
      },
      contentTypes: 'project,article,blog,explainer',
      contestCreation: 'admin',
      instanceCookies: [] as Array<{ name: string; category: string; description: string; duration: string; provider?: string }>,
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
