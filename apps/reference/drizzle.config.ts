import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './node_modules/@snaplify/schema/dist/**/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/snaplify',
  },
});
