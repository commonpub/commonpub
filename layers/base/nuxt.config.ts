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
      htmlAttrs: { lang: 'en' },
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
          // SRI: protects against a compromised CDN serving altered CSS.
          // If Font Awesome is upgraded, regenerate via:
          //   curl -sS https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css \
          //     | openssl dgst -sha384 -binary | openssl base64 -A | sed 's/^/sha384-/'
          integrity: 'sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g',
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
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Work+Sans:ital,wght@0,300..800;1,300..800&display=swap',
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
    uiTheme('stoa.css'),
    uiTheme('stoa-dark.css'),
    uiTheme('components.css'),
    uiTheme('prose.css'),
    uiTheme('layouts.css'),
    uiTheme('forms.css'),
    uiTheme('editor-panels.css'),
    // Explainer theme presets only (NOT base.css — it overrides site design system vars)
    '@commonpub/explainer/vue/theme/dark-industrial.css',
    '@commonpub/explainer/vue/theme/punk-zine.css',
    '@commonpub/explainer/vue/theme/paper-teal.css',
    '@commonpub/explainer/vue/theme/clean-light.css',
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
    // Email outbox worker knobs (email Phase 1). Strings (env vars are strings);
    // parsed in the plugin. Defaults match Resend's 5 req/s + 100/batch limits.
    emailWorkerIntervalMs: '8000',
    emailMaxPerTick: '200',
    emailBatchSize: '100',
    emailMaxSendsPerSecond: '5',
    emailMaxAttempts: '6',
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
      // Nuxt only propagates env-var overrides (NUXT_PUBLIC_FEATURES_X) for
      // keys DECLARED here. Undeclared keys are ignored at runtime, so
      // every flag in @commonpub/config's FeatureFlags type must appear
      // below — even if its default is false — or operators can't flip
      // it via env var on a per-instance basis. Drift caused
      // commonpub.io's first canary attempt to silently keep
      // layoutEngine:false at SSR despite NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true
      // being set on the container.
      features: {
        content: true,
        social: true,
        hubs: true,
        docs: true,
        video: true,
        contests: false,
        contestStageSubmissions: true,
        contestProposals: false,
        contestPii: false,
        events: false,
        learning: true,
        explainers: true,
        editorial: true,
        federation: false,
        federateHubs: false,
        seamlessFederation: false,
        admin: false,
        themeStudio: true,
        emailNotifications: false,
        adminBroadcast: false,
        requireTermsAcceptance: false,
        publicApi: false,
        contentImport: true,
        layoutEngine: false,
        rbac: false,
        actAsRegistry: false,
        announceToRegistry: true,
        publicApiMetricsFederation: false,
        // Nested identity sub-flags must be declared here too, or
        // NUXT_PUBLIC_FEATURES_IDENTITY_* env overrides silently drop (same
        // rule as the booleans above). Mirrors @commonpub/config's
        // IdentityFeatures; all default false.
        identity: {
          linkRemoteAccounts: false,
          signInWithRemote: false,
          actingAs: false,
          remoteInteract: false,
          remotePublish: false,
        },
      },
      contentTypes: 'project,blog,explainer',
      contestCreation: 'admin',
      instanceCookies: [] as Array<{ name: string; category: string; description: string; duration: string; provider?: string }>,
    },
  },
  // NOTE: /docs/** was previously set to `prerender: true` but this caused
  // production 500s because the Docker build stage has no DB access. During
  // prerender, the /api/docs fetch fails → the prerenderer saves the error
  // HTML as /docs/index.html in .output/public, and crawlLinks propagated
  // the failure to linked routes (/learn, /videos). Runtime SSR works fine
  // because the app then has real DB access. If caching is later needed,
  // use `swr: 60` (stale-while-revalidate at runtime), NOT `prerender: true`.
  routeRules: {},
  nitro: {
    preset: 'node-server',
    // Disable link-crawling during prerender so any future prerender rules
    // can't accidentally cascade failures to other routes.
    prerender: {
      crawlLinks: false,
      failOnError: false,
    },
  },
});
