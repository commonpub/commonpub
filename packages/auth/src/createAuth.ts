import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import * as schema from '@commonpub/schema';
import type { CreateAuthOptions } from './types.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createAuth({ config, db, secret, baseURL }: CreateAuthOptions) {
  const plugins = [username()];

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

  if (config.auth.github) {
    socialProviders.github = {
      clientId: config.auth.github.clientId,
      clientSecret: config.auth.github.clientSecret,
    };
  }

  if (config.auth.google) {
    socialProviders.google = {
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
    };
  }

  return betterAuth({
    secret,
    baseURL: baseURL ?? `https://${config.instance.domain}`,
    basePath: '/api/auth',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    user: {
      fields: {
        name: 'displayName',
        image: 'avatarUrl',
      },
    },
    emailAndPassword: {
      enabled: config.auth.emailPassword,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    socialProviders,
    plugins,
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
