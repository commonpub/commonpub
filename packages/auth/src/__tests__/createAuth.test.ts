/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// Mock better-auth before importing
vi.mock('better-auth', () => ({
  betterAuth: vi.fn((config) => ({
    config,
    api: {
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  })),
}));

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn((db, opts) => ({ db, ...opts })),
}));

vi.mock('better-auth/plugins', () => ({
  username: vi.fn(() => ({ id: 'username' })),
}));

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuth } from '../createAuth';

function createMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test',
      description: 'Test instance',
    },
    features: {
      communities: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation: false,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
      ...overrides,
    },
  } as any;
}

describe('createAuth', () => {
  it('should call betterAuth with correct base config', () => {
    const db = {} as any;
    createAuth({
      config: createMockConfig(),
      db,
      secret: 'test-secret',
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: 'test-secret',
        baseURL: 'https://test.example.com',
        basePath: '/api/auth',
        emailAndPassword: { enabled: true },
        session: {
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
        },
      }),
    );
  });

  it('should use drizzleAdapter with pg provider', () => {
    const db = {} as any;
    createAuth({
      config: createMockConfig(),
      db,
      secret: 'test-secret',
    });

    expect(drizzleAdapter).toHaveBeenCalledWith(db, expect.objectContaining({ provider: 'pg' }));
  });

  it('should use custom baseURL if provided', () => {
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
      baseURL: 'http://localhost:3000',
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:3000',
      }),
    );
  });

  it('should include GitHub provider when configured', () => {
    const config = createMockConfig({
      github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
    });

    createAuth({ config, db: {} as any, secret: 'test-secret' });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: expect.objectContaining({
          github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
        }),
      }),
    );
  });

  it('should include Google provider when configured', () => {
    const config = createMockConfig({
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
    });

    createAuth({ config, db: {} as any, secret: 'test-secret' });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: expect.objectContaining({
          google: { clientId: 'g-id', clientSecret: 'g-secret' },
        }),
      }),
    );
  });

  it('should not include social providers when not configured', () => {
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {},
      }),
    );
  });

  it('should include username plugin', () => {
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([expect.objectContaining({ id: 'username' })]),
      }),
    );
  });

  it('should disable email/password when config says so', () => {
    const config = createMockConfig({ emailPassword: false });

    createAuth({ config, db: {} as any, secret: 'test-secret' });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: { enabled: false },
      }),
    );
  });

  it('should wire sendResetPassword when emailSender is provided', () => {
    const sendResetPasswordEmail = vi.fn();
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
      emailSender: { sendResetPasswordEmail },
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: expect.objectContaining({
          enabled: true,
          sendResetPassword: expect.any(Function),
        }),
      }),
    );
  });

  it('should call emailSender.sendResetPasswordEmail with correct args', async () => {
    const sendResetPasswordEmail = vi.fn().mockResolvedValue(undefined);
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
      emailSender: { sendResetPasswordEmail },
    });

    const call = (betterAuth as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    const sendFn = call.emailAndPassword.sendResetPassword;
    await sendFn({ user: { email: 'test@example.com' }, url: 'https://example.com/reset?token=abc', token: 'abc' });

    expect(sendResetPasswordEmail).toHaveBeenCalledWith(
      'test@example.com',
      'https://example.com/reset?token=abc',
      'abc',
    );
  });

  it('should wire sendVerificationEmail when emailSender is provided', () => {
    const sendVerificationEmail = vi.fn();
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
      emailSender: { sendVerificationEmail },
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerification: expect.objectContaining({
          sendVerificationEmail: expect.any(Function),
          sendOnSignUp: true,
        }),
      }),
    );
  });

  it('should not wire email callbacks when emailSender is not provided', () => {
    createAuth({
      config: createMockConfig(),
      db: {} as any,
      secret: 'test-secret',
    });

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: { enabled: true },
      }),
    );
  });
});
