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
