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
      // Which analytics provider this instance uses, if any. The client loader
      // and the cookie registry both derive from it; the layer defaults it to
      // `provider: 'none'`, so an instance that omits it measures nothing.
      analytics: siteConfig.config.analytics ?? { provider: 'none' },
      // Consent is scoped to what was disclosed when it was given, and the scope
      // is derived from the cookie registry, so adding a provider re-asks by
      // itself. This is the operator's manual lever for the other case: a
      // material WORDING change that the registry cannot see. Bumping it
      // invalidates every stored choice exactly once.
      cookiePolicyVersion: siteConfig.config.instance.cookiePolicyVersion ?? '1',
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
