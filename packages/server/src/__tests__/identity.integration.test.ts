import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
});
