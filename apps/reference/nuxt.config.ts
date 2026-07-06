import siteConfig from './commonpub.config';

export default defineNuxtConfig({
  extends: ['../../layers/base'],
  runtimeConfig: {
    public: {
      // SEO brand / titles / unfurls. The layer defaults these to 'CommonPub';
      // wire them from THIS instance's config so every <title> / og:site_name is
      // branded correctly out of the box (the admin-set instance.name overrides
      // this at runtime via the site-identity-prime plugin — no redeploy needed).
      siteName: siteConfig.config.instance.name,
      siteDescription: siteConfig.config.instance.description,
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
