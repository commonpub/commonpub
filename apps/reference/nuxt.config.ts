export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: [
    '@commonpub/ui/theme/base.css',
    '@commonpub/ui/theme/dark.css',
  ],
  modules: [],
  runtimeConfig: {
    databaseUrl: '',
    authSecret: 'dev-secret-change-me',
    public: {
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
});
