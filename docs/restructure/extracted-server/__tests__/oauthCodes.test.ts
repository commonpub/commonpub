import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@commonpub/schema', () => ({
  oauthCodes: {
    code: 'oauthCodes.code',
    userId: 'oauthCodes.userId',
    clientId: 'oauthCodes.clientId',
    redirectUri: 'oauthCodes.redirectUri',
    expiresAt: 'oauthCodes.expiresAt',
    createdAt: 'oauthCodes.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  lt: vi.fn((_col, val) => ({ op: 'lt', val })),
}));

import { storeAuthCode, consumeAuthCode, cleanupExpiredCodes } from '../oauthCodes';

const clientId = 'client-1';
const redirectUri = 'https://example.com/callback';
const userId = 'user-1';

function createMockDb() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  return chain;
}

describe('OAuth Authorization Code Store (DB-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a code by inserting into the database', async () => {
    const db = createMockDb();
    await storeAuthCode(db as never, 'test-code', userId, clientId, redirectUri);
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'test-code', userId, clientId, redirectUri }),
    );
  });

  it('consumes a valid code', async () => {
    const db = createMockDb();
    const row = { code: 'test-code', userId, clientId, redirectUri, expiresAt: new Date(Date.now() + 600000), createdAt: new Date() };
    db.returning.mockResolvedValue([row]);

    const result = await consumeAuthCode(db as never, 'test-code', clientId, redirectUri);
    expect(result).toEqual({ userId });
    expect(db.delete).toHaveBeenCalled();
  });

  it('returns null for unknown code', async () => {
    const db = createMockDb();
    db.returning.mockResolvedValue([]);

    const result = await consumeAuthCode(db as never, 'nonexistent', clientId, redirectUri);
    expect(result).toBeNull();
  });

  it('rejects code with wrong clientId', async () => {
    const db = createMockDb();
    const row = { code: 'test-code', userId, clientId, redirectUri, expiresAt: new Date(Date.now() + 600000), createdAt: new Date() };
    db.returning.mockResolvedValue([row]);

    const result = await consumeAuthCode(db as never, 'test-code', 'wrong-client', redirectUri);
    expect(result).toBeNull();
  });

  it('rejects code with wrong redirectUri', async () => {
    const db = createMockDb();
    const row = { code: 'test-code', userId, clientId, redirectUri, expiresAt: new Date(Date.now() + 600000), createdAt: new Date() };
    db.returning.mockResolvedValue([row]);

    const result = await consumeAuthCode(db as never, 'test-code', clientId, 'https://evil.com/callback');
    expect(result).toBeNull();
  });

  it('rejects expired code', async () => {
    const db = createMockDb();
    const row = { code: 'test-code', userId, clientId, redirectUri, expiresAt: new Date(Date.now() - 1000), createdAt: new Date() };
    db.returning.mockResolvedValue([row]);

    const result = await consumeAuthCode(db as never, 'test-code', clientId, redirectUri);
    expect(result).toBeNull();
  });

  it('cleanupExpiredCodes deletes expired rows', async () => {
    const db = createMockDb();
    await cleanupExpiredCodes(db as never);
    expect(db.delete).toHaveBeenCalled();
    expect(db.where).toHaveBeenCalled();
  });
});
