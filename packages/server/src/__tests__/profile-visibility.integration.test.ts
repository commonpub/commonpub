/**
 * Profile visibility (session 261). `settings/privacy` promises "Only you can see
 * your profile" (private) and "Only people signed in to this site" (members), but
 * the profile and its lists read the setting nowhere outside the sitemap, the
 * directory and the public API. One rule, enforced at every read: the predicate
 * for a single profile and the SQL condition for lists must agree.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { users } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { canViewProfile, profileVisibleTo, findProfileGate } from '../profile/visibility.js';
import { followUser, listFollowers, listFollowing } from '../social/social.js';

describe('canViewProfile', () => {
  const t = (profileVisibility: string) => ({ id: 'target', profileVisibility });
  it('public: everyone', () => {
    expect(canViewProfile(t('public'), null)).toBe(true);
    expect(canViewProfile(t('public'), 'someone')).toBe(true);
  });
  it('members: signed-in viewers only', () => {
    expect(canViewProfile(t('members'), null)).toBe(false);
    expect(canViewProfile(t('members'), undefined)).toBe(false);
    expect(canViewProfile(t('members'), 'someone')).toBe(true);
  });
  it('private: the owner only', () => {
    expect(canViewProfile(t('private'), null)).toBe(false);
    expect(canViewProfile(t('private'), 'someone')).toBe(false);
    expect(canViewProfile(t('private'), 'target')).toBe(true);
  });
  it('an unknown value is hidden, not shown (allow-list)', () => {
    expect(canViewProfile(t('friends'), 'someone')).toBe(false);
    expect(canViewProfile(t(''), 'someone')).toBe(false);
  });
  it('the owner always sees their own, whatever the setting', () => {
    for (const v of ['public', 'members', 'private', 'friends']) expect(canViewProfile(t(v), 'target')).toBe(true);
  });
});

describe('profile visibility in the database', () => {
  let db: DB;
  const id: Record<string, string> = {};
  beforeAll(async () => {
    db = await createTestDB();
    const stamp = Date.now();
    for (const [name, vis] of [['star', 'public'], ['pub', 'public'], ['mem', 'members'], ['priv', 'private'], ['viewer', 'public']] as const) {
      const u = await createTestUser(db, { username: `${name}-${stamp}` });
      id[name] = u.id;
      await db.update(users).set({ profileVisibility: vis }).where(eq(users.id, u.id));
    }
    // pub, mem and priv all follow star; star follows all three back.
    for (const f of ['pub', 'mem', 'priv']) {
      await followUser(db, id[f]!, id.star!);
      await followUser(db, id.star!, id[f]!);
    }
  });
  afterAll(async () => { await closeTestDB(db); });

  const names = (items: Array<{ id: string }>) => items.map((i) => Object.keys(id).find((k) => id[k] === i.id)).sort();

  it('lists show only the people this viewer may see, and count them the same way', async () => {
    const anon = await listFollowers(db, id.star!, {}, undefined);
    expect(names(anon.items)).toEqual(['pub']);
    expect(anon.total).toBe(1);

    const member = await listFollowers(db, id.star!, {}, id.viewer);
    expect(names(member.items)).toEqual(['mem', 'pub']);
    expect(member.total).toBe(2);

    const following = await listFollowing(db, id.star!, {}, undefined);
    expect(names(following.items)).toEqual(['pub']);
    expect(following.total).toBe(1);
  });

  it('a private member still sees themself in a list', async () => {
    const own = await listFollowers(db, id.star!, {}, id.priv);
    expect(names(own.items)).toEqual(['mem', 'priv', 'pub']);
  });

  it('the SQL condition and the predicate agree for every viewer', async () => {
    const rows = await db.select({ id: users.id, profileVisibility: users.profileVisibility }).from(users);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const viewer of [undefined, id.viewer, id.priv, id.mem]) {
      const visible = new Set((await db.select({ id: users.id }).from(users).where(profileVisibleTo(viewer))).map((r) => r.id));
      for (const r of rows) expect(visible.has(r.id), `${r.profileVisibility} for ${viewer}`).toBe(canViewProfile(r, viewer));
    }
  });

  it('findProfileGate returns what the gate needs, and nothing for an unknown name', async () => {
    const [row] = await db.select({ username: users.username }).from(users).where(eq(users.id, id.priv!));
    expect(await findProfileGate(db, row!.username)).toEqual({ id: id.priv, profileVisibility: 'private' });
    expect(await findProfileGate(db, 'nobody-by-this-name')).toBeNull();
  });
});
