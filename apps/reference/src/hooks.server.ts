import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@snaplify/schema';
import { createAuth, createAuthHook } from '@snaplify/auth';
import { defineSnaplifyConfig } from '@snaplify/config';
import { env } from '$env/dynamic/private';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

const { config } = defineSnaplifyConfig({
  instance: {
    domain: env.PUBLIC_DOMAIN ?? 'localhost:5173',
    name: env.PUBLIC_INSTANCE_NAME ?? 'Snaplify',
    description: env.PUBLIC_INSTANCE_DESCRIPTION ?? 'A maker community',
  },
  features: {
    content: env.FEATURE_CONTENT !== 'false',
    social: env.FEATURE_SOCIAL !== 'false',
  },
  auth: {
    emailPassword: true,
  },
});

const auth = createAuth({
  config,
  db,
  secret: env.AUTH_SECRET ?? 'dev-secret-change-in-production',
  baseURL: env.AUTH_BASE_URL ?? `http://localhost:5173`,
});

const authHook = createAuthHook({ auth });

const dbHook: Handle = async ({ event, resolve }) => {
  event.locals.db = db;
  return resolve(event);
};

export const handle = sequence(dbHook, authHook as Handle);
