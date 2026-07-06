import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub, deleteHub, getFeaturedHub, FEATURED_HUB_SETTING_KEY } from '../hub/hub.js';

async function setFeatured(db: DB, value: string): Promise<void> {
  await db.insert(instanceSettings).values({ key: FEATURED_HUB_SETTING_KEY, value })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { value } });
}

describe('getFeaturedHub (instance-setting featured hub)', () => {
  let db: DB;
  let ownerId: string;
  let publicHubId: string;
  let privateHubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    ownerId = (await createTestUser(db, { username: 'featowner' })).id;
    publicHubId = (await createHub(db, ownerId, { name: 'Edge AI Foundation', hubType: 'community' })).id;
    privateHubId = (await createHub(db, ownerId, { name: 'Secret Hub', hubType: 'community', privacy: 'private' })).id;
  });

  afterAll(async () => { await closeTestDB(db); });

  it('returns null when no featured hub is set', async () => {
    expect(await getFeaturedHub(db)).toBeNull();
  });

  it('returns the featured hub (list-item shape) when set to a public hub', async () => {
    await setFeatured(db, publicHubId);
    const f = await getFeaturedHub(db);
    expect(f).not.toBeNull();
    expect(f?.id).toBe(publicHubId);
    expect(f?.name).toBe('Edge AI Foundation');
    expect(f?.slug).toBeTruthy();
    expect(f?.createdBy).toBeTruthy();
  });

  it('never features a private hub', async () => {
    await setFeatured(db, privateHubId);
    expect(await getFeaturedHub(db)).toBeNull();
  });

  it('returns null (no throw) for a malformed non-uuid setting value', async () => {
    await setFeatured(db, 'not-a-uuid');
    expect(await getFeaturedHub(db)).toBeNull();
  });

  it('returns null for a well-formed uuid that matches no hub', async () => {
    await setFeatured(db, '00000000-0000-4000-8000-000000000000');
    expect(await getFeaturedHub(db)).toBeNull();
  });

  it('returns null once the featured hub is soft-deleted', async () => {
    await setFeatured(db, publicHubId);
    expect((await getFeaturedHub(db))?.id).toBe(publicHubId);
    await deleteHub(db, publicHubId, ownerId);
    expect(await getFeaturedHub(db)).toBeNull();
  });

  it('returns null when the setting is cleared (empty string)', async () => {
    await db.update(instanceSettings).set({ value: '' }).where(eq(instanceSettings.key, FEATURED_HUB_SETTING_KEY));
    expect(await getFeaturedHub(db)).toBeNull();
  });
});
