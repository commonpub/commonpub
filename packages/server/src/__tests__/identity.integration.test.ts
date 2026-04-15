import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { resolveIdentityToEmail } from '../auth/identity.js';

describe('resolveIdentityToEmail', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    await createTestUser(db, { username: 'testuser', email: 'testuser@example.com' });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('passes through an email identity unchanged', async () => {
    const result = await resolveIdentityToEmail(db, 'someone@example.com');
    expect(result).toBe('someone@example.com');
  });

  it('resolves a username to the corresponding email', async () => {
    const result = await resolveIdentityToEmail(db, 'testuser');
    expect(result).toBe('testuser@example.com');
  });

  it('throws when username is not found', async () => {
    await expect(resolveIdentityToEmail(db, 'nonexistent')).rejects.toThrow('Invalid credentials');
  });

  it('rejects soft-deleted users', async () => {
    const deleted = await createTestUser(db, { username: 'deleteduser', email: 'deleted@example.com' });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));
    await expect(resolveIdentityToEmail(db, 'deleteduser')).rejects.toThrow('Invalid credentials');
  });
});
