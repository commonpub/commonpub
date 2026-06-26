import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { getEmailBranding, EMAIL_BRANDING_KEY } from '../comms/branding.js';
import { setInstanceSetting } from '../admin/admin.js';

// Email Phase 2: getEmailBranding reads + re-validates the stored branding.

describe('getEmailBranding', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    adminId = (await createTestUser(db, { username: `eb-admin-${Date.now()}` })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  it('returns {} when unset', async () => {
    expect(await getEmailBranding(db)).toEqual({});
  });

  it('returns the saved branding', async () => {
    await setInstanceSetting(db, EMAIL_BRANDING_KEY, { accentColor: '#123456', headerText: 'Acme' }, adminId);
    expect(await getEmailBranding(db)).toEqual({ accentColor: '#123456', headerText: 'Acme' });
  });

  it('drops a value that fails re-validation (defense in depth)', async () => {
    // Simulate a corrupted/legacy row that bypassed write validation.
    await setInstanceSetting(db, EMAIL_BRANDING_KEY, { accentColor: 'red', evil: '<script>' }, adminId);
    expect(await getEmailBranding(db)).toEqual({});
  });
});
