import siteConfig from './commonpub.config';

export default defineNuxtConfig({
  extends: ['../../layers/base'],
  runtimeConfig: {
    public: {
      // Expose this instance's declared non-essential cookies to the client so the
      // cookie-consent banner can ask about them (the layer defaults this to []).
      instanceCookies: siteConfig.config.cookies ?? [],
      // Keep the register page's check-email screen in sync with the server's
      // auth.requireEmailVerification (createAuth). Default OFF.
      requireEmailVerification: siteConfig.config.auth.requireEmailVerification === true,
    },
  },
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  nitro: {
    // Local uploads (LocalStorageAdapter) are written at RUNTIME, which Nitro's
    // build-time `publicAssets` can't serve — they're streamed by
    // server/routes/uploads/[...path].get.ts instead. With S3/Spaces configured,
    // files are served from the bucket/CDN and this route is simply unused.
  },
  vite: {
    server: {
      fs: {
        allow: ['../..'],
      },
    },
  },
});
