import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { searchUsers } from '../profile/profile.js';
import type { DB } from '../types.js';

describe('searchUsers', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    await createTestUser(db, { username: 'alice_wonder', displayName: 'Alice Wonderland' });
    await createTestUser(db, { username: 'bob_builder', displayName: 'Bob the Builder' });
    const gone = await createTestUser(db, { username: 'ghost_user', displayName: 'Ghost' });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('finds by username substring (case-insensitive)', async () => {
    const r = await searchUsers(db, 'ALICE');
    expect(r.map((u) => u.username)).toContain('alice_wonder');
  });

  it('finds by display name substring', async () => {
    const r = await searchUsers(db, 'builder');
    expect(r.map((u) => u.username)).toContain('bob_builder');
  });

  it('returns public fields only (never email/role)', async () => {
    const [u] = await searchUsers(db, 'alice');
    expect(u).toBeDefined();
    expect(Object.keys(u!).sort()).toEqual(['avatarUrl', 'displayName', 'id', 'username']);
  });

  it('excludes soft-deleted users', async () => {
    expect(await searchUsers(db, 'ghost')).toHaveLength(0);
  });

  it('returns empty for queries shorter than 2 chars', async () => {
    expect(await searchUsers(db, 'a')).toHaveLength(0);
    expect(await searchUsers(db, '')).toHaveLength(0);
  });

  it('escapes LIKE metacharacters so % is not a wildcard (no injection)', async () => {
    // With escaping, "a%" matches a LITERAL "a%" (none exist) rather than acting as
    // "contains a" — which the unescaped version would, returning alice. RED on revert.
    expect(await searchUsers(db, 'a%')).toHaveLength(0);
  });
});
