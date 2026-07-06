import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  getEffectiveSiteName,
  getEffectiveSiteDescription,
  INSTANCE_NAME_SETTING_KEY,
  INSTANCE_DESCRIPTION_SETTING_KEY,
} from '../admin/admin.js';

describe('effective site identity (SEO brand from instance settings, no redeploy)', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('falls back to the config default when no instance_settings override exists', async () => {
    expect(await getEffectiveSiteName(db, 'CommonPub')).toBe('CommonPub');
    expect(await getEffectiveSiteName(db, 'devEco.io')).toBe('devEco.io');
    expect(await getEffectiveSiteDescription(db, 'A CommonPub instance')).toBe('A CommonPub instance');
  });

  it('uses the instance_settings override when present, and reflects updates', async () => {
    await db.insert(instanceSettings).values({ key: INSTANCE_NAME_SETTING_KEY, value: 'devEco.io' });
    expect(await getEffectiveSiteName(db, 'CommonPub')).toBe('devEco.io');

    await db.update(instanceSettings).set({ value: 'Edge AI Foundation' })
      .where(eq(instanceSettings.key, INSTANCE_NAME_SETTING_KEY));
    expect(await getEffectiveSiteName(db, 'CommonPub')).toBe('Edge AI Foundation');
  });

  it('ignores a blank override (falls back) and coerces a numeric jsonb scalar to a string', async () => {
    // blank string -> treated as unset (fall back to the config default)
    await db.update(instanceSettings).set({ value: '' })
      .where(eq(instanceSettings.key, INSTANCE_NAME_SETTING_KEY));
    expect(await getEffectiveSiteName(db, 'CommonPub')).toBe('CommonPub');

    // PGlite can read a jsonb scalar back as a number; coerce to string
    await db.update(instanceSettings).set({ value: 2026 as unknown as string })
      .where(eq(instanceSettings.key, INSTANCE_NAME_SETTING_KEY));
    expect(await getEffectiveSiteName(db, 'CommonPub')).toBe('2026');
  });

  it('resolves description independently of name', async () => {
    await db.insert(instanceSettings).values({
      key: INSTANCE_DESCRIPTION_SETTING_KEY,
      value: 'Edge AI project sharing and community platform',
    });
    expect(await getEffectiveSiteDescription(db, 'fallback'))
      .toBe('Edge AI project sharing and community platform');
  });
});
