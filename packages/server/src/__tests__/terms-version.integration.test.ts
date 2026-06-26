import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceSettings, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getEffectiveTermsVersion,
  needsTermsReacceptance,
  recordConsent,
  TERMS_VERSION_SETTING_KEY,
} from '../profile/consent.js';

describe('effective terms version (runtime bump without redeploy)', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('falls back to the config default when no instance_settings override exists', async () => {
    expect(await getEffectiveTermsVersion(db, '1')).toBe('1');
    expect(await getEffectiveTermsVersion(db, '7')).toBe('7');
  });

  it('uses the instance_settings override when present', async () => {
    await db.insert(instanceSettings).values({ key: TERMS_VERSION_SETTING_KEY, value: '2' });
    expect(await getEffectiveTermsVersion(db, '1')).toBe('2');
    // an update is reflected
    await db.update(instanceSettings).set({ value: '3' }).where(eq(instanceSettings.key, TERMS_VERSION_SETTING_KEY));
    expect(await getEffectiveTermsVersion(db, '1')).toBe('3');
  });

  it('full bump flow: bumping the version re-prompts, and re-accepting at the effective version clears it', async () => {
    const userId = (await createTestUser(db, { username: 'tv' })).id;
    // user accepted v1 at signup
    await recordConsent(db, { userId, kind: 'terms', version: '1' });

    // effective version is currently '3' (from the previous test's override) -> stale
    const eff1 = await getEffectiveTermsVersion(db, '1');
    expect(await needsTermsReacceptance(db, userId, { enabled: true, termsVersion: eff1 })).toBe(true);

    // re-accept at the EFFECTIVE version (what the consent endpoint must do)
    await recordConsent(db, { userId, kind: 'terms', version: eff1 });
    expect(await needsTermsReacceptance(db, userId, { enabled: true, termsVersion: eff1 })).toBe(false);

    // flag off -> never prompts regardless of version drift
    expect(await needsTermsReacceptance(db, userId, { enabled: false, termsVersion: 'anything' })).toBe(false);

    // sanity: denormalized column now holds the effective version
    const [u] = await db.select({ v: users.acceptedTermsVersion }).from(users).where(eq(users.id, userId));
    expect(u?.v).toBe(eff1);
  });
});
