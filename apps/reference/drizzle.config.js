import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema/dist/*.js',
  out: './schema/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL || 'postgresql://commonpub:commonpub_dev@localhost:5433/commonpub',
  },
});
