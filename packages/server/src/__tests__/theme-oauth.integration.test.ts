import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { resolveTheme, getCustomTokenOverrides, setUserTheme } from '../theme.js';
import { storeAuthCode, consumeAuthCode, cleanupExpiredCodes } from '../oauthCodes.js';
import { instanceSettings } from '@commonpub/schema';

describe('theme + oauth integration', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db);
    userId = user.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Theme tests ---

  describe('resolveTheme', () => {
    it('resolves to base theme by default', async () => {
      const theme = await resolveTheme(db);
      expect(theme).toBe('base');
    });

    it('resolves user theme preference', async () => {
      await setUserTheme(db, userId, 'dark');
      const theme = await resolveTheme(db, userId);
      expect(theme).toBe('dark');
    });

    it('resolves instance default when no user preference', async () => {
      await db.insert(instanceSettings).values({
        key: 'theme.default',
        value: 'generics',
      });

      // No userId — should fall back to instance default
      const theme = await resolveTheme(db);
      expect(theme).toBe('generics');
    });

    it('user preference takes priority over instance default', async () => {
      // Instance default is already 'generics' from previous test
      // User theme is already 'dark' from previous test
      const theme = await resolveTheme(db, userId);
      expect(theme).toBe('dark');
    });

    it('rejects invalid theme ID', async () => {
      await expect(setUserTheme(db, userId, 'invalid-theme')).rejects.toThrow(
        'Invalid theme ID: invalid-theme',
      );
    });
  });

  describe('getCustomTokenOverrides', () => {
    it('returns empty overrides by default', async () => {
      const overrides = await getCustomTokenOverrides(db);
      expect(overrides).toEqual({});
    });

    it('returns stored token overrides', async () => {
      const tokenOverrides = {
        '--color-primary': '#ff0000',
        '--font-heading': 'Inter',
      };

      await db.insert(instanceSettings).values({
        key: 'theme.token_overrides',
        value: tokenOverrides,
      });

      const result = await getCustomTokenOverrides(db);
      expect(result).toEqual(tokenOverrides);
    });
  });

  // --- OAuth code tests ---

  describe('oauth codes', () => {
    const clientId = 'test-client-id';
    const redirectUri = 'https://example.com/callback';

    it('stores and consumes a code', async () => {
      const code = crypto.randomUUID();
      await storeAuthCode(db, code, userId, clientId, redirectUri);

      const result = await consumeAuthCode(db, code, clientId, redirectUri);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
    });

    it('code is single-use', async () => {
      const code = crypto.randomUUID();
      await storeAuthCode(db, code, userId, clientId, redirectUri);

      const first = await consumeAuthCode(db, code, clientId, redirectUri);
      expect(first).not.toBeNull();

      const second = await consumeAuthCode(db, code, clientId, redirectUri);
      expect(second).toBeNull();
    });

    it('rejects wrong clientId', async () => {
      const code = crypto.randomUUID();
      await storeAuthCode(db, code, userId, 'clientA', redirectUri);

      const result = await consumeAuthCode(db, code, 'clientB', redirectUri);
      expect(result).toBeNull();
    });

    it('rejects wrong redirectUri', async () => {
      const code = crypto.randomUUID();
      await storeAuthCode(db, code, userId, clientId, 'https://a.example.com/cb');

      const result = await consumeAuthCode(db, code, clientId, 'https://b.example.com/cb');
      expect(result).toBeNull();
    });

    it('cleans up expired codes', async () => {
      const code = crypto.randomUUID();
      await storeAuthCode(db, code, userId, clientId, redirectUri);

      // cleanupExpiredCodes should run without error even if no codes are expired
      await expect(cleanupExpiredCodes(db)).resolves.toBeUndefined();
    });
  });
});
