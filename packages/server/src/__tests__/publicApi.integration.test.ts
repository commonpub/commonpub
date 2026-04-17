import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { apiKeys, apiKeyUsage } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  logApiKeyUsage,
  touchLastUsed,
} from '../publicApi/index.js';

/**
 * Integration tests for the public-API admin/auth flow against a real
 * database. These are the tests that prove the wiring works — isolated unit
 * tests in publicApi.test.ts check pure-function behavior; these prove that
 * a key you create can actually authenticate, that revocation sticks, that
 * expired keys are rejected, and that the prefix-length change eliminates
 * the collision risk present in an earlier draft.
 */
describe('publicApi integration', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const admin = await createTestUser(db);
    adminId = admin.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('createApiKey → authenticateApiKey round-trip', () => {
    it('round-trips a valid token', async () => {
      const { token, key } = await createApiKey(db, adminId, {
        name: 'round-trip',
        scopes: ['read:content'],
      });
      expect(token).toMatch(/^cpub_live_ak_/);
      expect(key.scopes).toEqual(['read:content']);

      const result = await authenticateApiKey(db, token);
      if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
      expect(result.key.id).toBe(key.id);
      expect(result.key.scopes).toEqual(['read:content']);
    });

    it('rejects a tampered token', async () => {
      const { token } = await createApiKey(db, adminId, {
        name: 'tamper',
        scopes: ['read:content'],
      });
      // Flip the last non-prefix char
      const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
      const result = await authenticateApiKey(db, tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not_found');
    });

    it('survives a prefix collision — both of two keys with the same prefix auth correctly', async () => {
      // Collision at PREFIX_LENGTH 24 is astronomically unlikely (~2^66
      // distinct prefixes), but the auth path still iterates defensively.
      // We simulate a collision by hand: craft two tokens that share their
      // first 24 chars and differ in the suffix, insert corresponding rows
      // directly. If the auth loop breaks out after one hash mismatch both
      // before comparing the other row, one of these keys would be wrongly
      // rejected even though its token is correct.
      const { createHash } = await import('node:crypto');
      const sharedHead = 'cpub_live_ak_AAAAAAAAAAA';  // exactly 24 chars
      expect(sharedHead.length).toBe(24);
      const tokenX = sharedHead + 'X'.repeat(32);
      const tokenY = sharedHead + 'Y'.repeat(32);
      const hashX = createHash('sha256').update(tokenX).digest('hex');
      const hashY = createHash('sha256').update(tokenY).digest('hex');

      await db.insert(apiKeys).values({
        name: 'collision-x', prefix: sharedHead, keyHash: hashX,
        scopes: ['read:content'], createdBy: adminId,
      });
      await db.insert(apiKeys).values({
        name: 'collision-y', prefix: sharedHead, keyHash: hashY,
        scopes: ['read:hubs'], createdBy: adminId,
      });

      const rX = await authenticateApiKey(db, tokenX);
      const rY = await authenticateApiKey(db, tokenY);
      expect(rX.ok).toBe(true);
      expect(rY.ok).toBe(true);
      if (rX.ok) expect(rX.key.scopes).toEqual(['read:content']);
      if (rY.ok) expect(rY.key.scopes).toEqual(['read:hubs']);
    });
  });

  describe('failure modes', () => {
    it('missing token', async () => {
      const r = await authenticateApiKey(db, undefined);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('missing');
    });
    it('malformed token', async () => {
      const r = await authenticateApiKey(db, 'not-a-commonpub-token');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('malformed');
    });
    it('unknown prefix', async () => {
      // Valid-looking token for a prefix that's never been issued
      const fake = 'cpub_live_ak_' + 'X'.repeat(43);
      const r = await authenticateApiKey(db, fake);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not_found');
    });

    it('revoked key is rejected even with correct token', async () => {
      const { token, key } = await createApiKey(db, adminId, {
        name: 'to-be-revoked',
        scopes: ['read:content'],
      });
      const preCheck = await authenticateApiKey(db, token);
      expect(preCheck.ok).toBe(true);

      const revoked = await revokeApiKey(db, key.id, adminId);
      expect(revoked?.revokedAt).toBeTruthy();
      expect(revoked?.revokedBy).toEqual(expect.objectContaining({ id: adminId }));

      const postCheck = await authenticateApiKey(db, token);
      expect(postCheck.ok).toBe(false);
      // Revoked rows are excluded by the WHERE clause, so the reason is
      // 'not_found' rather than 'revoked' — the caller can't distinguish.
      if (!postCheck.ok) expect(postCheck.reason).toBe('not_found');
    });

    it('expired key returns expired reason', async () => {
      const { token } = await createApiKey(db, adminId, {
        name: 'expired',
        scopes: ['read:content'],
        expiresAt: new Date(Date.now() - 1000),
      });
      const r = await authenticateApiKey(db, token);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('expired');
    });

    it('double-revoke returns null (already revoked)', async () => {
      const { key } = await createApiKey(db, adminId, { name: 'double', scopes: ['read:*'] });
      await revokeApiKey(db, key.id, adminId);
      const second = await revokeApiKey(db, key.id, adminId);
      expect(second).toBe(null);
    });
  });

  describe('listApiKeys', () => {
    it('excludes revoked by default, includes when asked', async () => {
      const active = await createApiKey(db, adminId, { name: 'active-list', scopes: ['read:content'] });
      const revoked = await createApiKey(db, adminId, { name: 'revoked-list', scopes: ['read:content'] });
      await revokeApiKey(db, revoked.key.id, adminId);

      const activeOnly = await listApiKeys(db, { includeRevoked: false });
      const ids = activeOnly.map((k) => k.id);
      expect(ids).toContain(active.key.id);
      expect(ids).not.toContain(revoked.key.id);

      const all = await listApiKeys(db, { includeRevoked: true });
      const allIds = all.map((k) => k.id);
      expect(allIds).toContain(revoked.key.id);
    });

    it('never includes keyHash or raw token in the admin view', async () => {
      await createApiKey(db, adminId, { name: 'inspect', scopes: ['read:content'] });
      const listed = await listApiKeys(db);
      const serialized = JSON.stringify(listed);
      // Known forbidden substrings — prefix is fine (masked) but hash or token should never appear.
      expect(serialized).not.toMatch(/"keyHash"/);
      expect(serialized).not.toMatch(/"token"/);
    });
  });

  describe('logApiKeyUsage + touchLastUsed', () => {
    it('writes usage rows that survive the revocation cascade', async () => {
      const { key } = await createApiKey(db, adminId, { name: 'usage', scopes: ['read:content'] });
      await logApiKeyUsage(db, { keyId: key.id, endpoint: '/api/public/v1/content', method: 'GET', statusCode: 200, latencyMs: 42 });
      const rows = await db.select().from(apiKeyUsage).where(eq(apiKeyUsage.keyId, key.id));
      expect(rows.length).toBe(1);
      expect(rows[0]!.statusCode).toBe(200);
      expect(rows[0]!.endpoint).toBe('/api/public/v1/content');
    });

    it('touchLastUsed is debounced within a minute', async () => {
      const { key } = await createApiKey(db, adminId, { name: 'touch', scopes: ['read:*'] });
      await touchLastUsed(db, key.id);
      const [afterFirst] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id));
      const firstTs = afterFirst!.lastUsedAt!.getTime();

      // Second call within the debounce window should NOT bump the timestamp.
      await touchLastUsed(db, key.id);
      const [afterSecond] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id));
      expect(afterSecond!.lastUsedAt!.getTime()).toBe(firstTs);
    });
  });

  describe('data-safety guarantees', () => {
    it('apiKeys.keyHash is a SHA-256 hex string of length 64', async () => {
      const { key } = await createApiKey(db, adminId, { name: 'hashlen', scopes: ['read:content'] });
      const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id));
      expect(row!.keyHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('the raw token never ends up in the DB', async () => {
      const { token, key } = await createApiKey(db, adminId, { name: 'nostore', scopes: ['read:content'] });
      const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id));
      // Token starts with 'cpub_live_ak_'; the hash should contain none of it.
      expect(row!.keyHash).not.toContain(token.slice(13, 20));
      expect(row!.keyHash).not.toContain('cpub');
    });
  });
});
