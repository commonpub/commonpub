import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiTheme = (file: string) => resolve(__dirname, '../../packages/ui/theme', file);

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
  },
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
  modules: [],
  runtimeConfig: {
    databaseUrl: '',
    authSecret: 'dev-secret-change-me',
    // Email — "console" (dev), "smtp" (nodemailer), or "resend" (Resend API)
    emailAdapter: 'console',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    resendApiKey: '',
    resendFrom: '',
    // Storage — set S3_BUCKET to enable S3/DO Spaces/MinIO, otherwise local filesystem
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
      // Feature flags — override with NUXT_PUBLIC_FEATURES_HUBS=false etc.
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
        admin: false,
      },
      // Enabled content types (comma-separated) — override with NUXT_PUBLIC_CONTENT_TYPES=project,blog
      contentTypes: 'project,article,blog,explainer',
      // Who can create contests — override with NUXT_PUBLIC_CONTEST_CREATION=staff
      contestCreation: 'admin',
    },
  },
  routeRules: {
    '/docs/**': { prerender: true },
  },
  nitro: {
    preset: 'node-server',
    // Serve local uploads directory in dev (production uses S3/Spaces)
    publicAssets: [
      {
        dir: '../uploads',
        baseURL: '/uploads',
        maxAge: 60 * 60 * 24, // 1 day cache
      },
    ],
  },
  vite: {
    server: {
      fs: {
        allow: ['../..'],
      },
    },
  },
});
