import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CommonPubConfig } from '@commonpub/config';
import { checkIdentityConfig, assertIdentityConfig } from '../health.js';

const VALID_KEY = '0'.repeat(64);

// Minimal CommonPubConfig builder — kept inline (rather than importing
// @commonpub/test-utils) so this test file doesn't add a workspace dep
// that @commonpub/server otherwise doesn't need.
function makeConfig(idOverrides: Partial<CommonPubConfig['features']['identity']> = {}): CommonPubConfig {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test',
      description: 'Test instance',
    },
    features: {
      content: true, social: true, hubs: true, docs: true, video: true,
      contests: false, events: false, learning: true, explainers: true,
      editorial: true, federation: false, seamlessFederation: false,
      federateHubs: false, admin: false, emailNotifications: false,
      publicApi: false, contentImport: true, layoutEngine: false, rbac: false,
      actAsRegistry: false, announceToRegistry: false,
      identity: {
        linkRemoteAccounts: false,
        signInWithRemote: false,
        actingAs: false,
        remoteInteract: false,
        remotePublish: false,
        ...idOverrides,
      },
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
    },
    docs: {
      searchLanguage: 'english',
    },
  };
}

describe('checkIdentityConfig', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.CPUB_FED_TOKEN_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CPUB_FED_TOKEN_KEY;
    else process.env.CPUB_FED_TOKEN_KEY = originalKey;
  });

  it('ok when no identity flags are enabled', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig());
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('ok when only `actingAs` is enabled (no token I/O)', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig({ actingAs: true }));
    expect(result.ok).toBe(true);
  });

  it('errors when linkRemoteAccounts is on without key', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig({ linkRemoteAccounts: true }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/CPUB_FED_TOKEN_KEY/);
  });

  it('errors when signInWithRemote is on without key', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig({ signInWithRemote: true }));
    expect(result.ok).toBe(false);
  });

  it('errors when remoteInteract is on without key', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig({ remoteInteract: true }));
    expect(result.ok).toBe(false);
  });

  it('errors when remotePublish is on without key', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    const result = checkIdentityConfig(makeConfig({ remotePublish: true }));
    expect(result.ok).toBe(false);
  });

  it('ok when token-using flag is on AND key is configured', () => {
    process.env.CPUB_FED_TOKEN_KEY = VALID_KEY;
    const result = checkIdentityConfig(makeConfig({ linkRemoteAccounts: true, remotePublish: true }));
    expect(result.ok).toBe(true);
  });

  it('errors when key is malformed (wrong length)', () => {
    process.env.CPUB_FED_TOKEN_KEY = '0'.repeat(63);
    const result = checkIdentityConfig(makeConfig({ linkRemoteAccounts: true }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/CPUB_FED_TOKEN_KEY/);
  });
});

describe('assertIdentityConfig', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.CPUB_FED_TOKEN_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CPUB_FED_TOKEN_KEY;
    else process.env.CPUB_FED_TOKEN_KEY = originalKey;
  });

  it('does not throw when ok', () => {
    process.env.CPUB_FED_TOKEN_KEY = VALID_KEY;
    expect(() => assertIdentityConfig(makeConfig({ linkRemoteAccounts: true }))).not.toThrow();
  });

  it('throws with all errors joined when not ok', () => {
    delete process.env.CPUB_FED_TOKEN_KEY;
    expect(() => assertIdentityConfig(makeConfig({ linkRemoteAccounts: true }))).toThrow(/misconfigured.*CPUB_FED_TOKEN_KEY/s);
  });
});
