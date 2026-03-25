import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import * as schema from '@commonpub/schema';
import type { CreateAuthOptions } from './types.js';

/** Callback type for sending auth-related emails */
export interface AuthEmailSender {
  sendVerificationEmail?: (email: string, url: string, token: string) => Promise<void>;
  sendResetPasswordEmail?: (email: string, url: string, token: string) => Promise<void>;
}

export function createAuth({ config, db, secret, baseURL, trustedOrigins, emailSender }: CreateAuthOptions & { emailSender?: AuthEmailSender }) {
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
    trustedOrigins: trustedOrigins ?? [baseURL ?? `https://${config.instance.domain}`],
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
      sendResetPassword: emailSender?.sendResetPasswordEmail
        ? async ({ user, url, token }) => {
            await emailSender.sendResetPasswordEmail!(user.email, url, token);
          }
        : undefined,
    },
    emailVerification: emailSender?.sendVerificationEmail
      ? {
          sendVerificationEmail: async ({ user, url, token }) => {
            await emailSender.sendVerificationEmail!(user.email, url, token);
          },
          sendOnSignUp: true,
        }
      : undefined,
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
