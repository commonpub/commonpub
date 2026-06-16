export default defineNuxtConfig({
  extends: ['../../layers/base'],
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
