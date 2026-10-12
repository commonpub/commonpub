/**
 * Profile visibility, enforced at every profile read (session 261).
 *
 * `settings/privacy` promised "Only you can see your profile" while
 * `GET /api/users/:username` and its lists returned everything to anyone. These
 * run the shipped handlers on PGlite with the real `getOptionalUser`, the real
 * `requireVisibleProfile` and the real rule from @commonpub/server, for three
 * viewers (signed out, another member, the owner) against three settings.
 *
 * A sweep at the end proves every per-user API route calls the gate, and that it
 * walked the files it claims to, so a new route can't quietly skip it.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { users } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../packages/server/src/types';
import { followUser } from '../../../../../../packages/server/src/social/social';
import { harness, installNitroStubs, makeEvent, expectStatus } from '../../../../test-helpers/nitroStubs';

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;
type Vis = 'public' | 'members' | 'private';

let db: DB;
const ids: Record<string, string> = {};
const names: Record<string, string> = {};
const h: Record<string, Handler> = {};

function as(viewer: string | null, params: Record<string, string> = {}, query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return makeEvent({
    params, query, headers,
    context: viewer ? { auth: { user: { id: ids[viewer], role: 'member' } } } : {},
  });
}

beforeAll(async () => {
  await installNitroStubs();
  const g = globalThis as unknown as Record<string, unknown>;
  const auth = await import('../../../utils/auth');
  g.requireAuth = auth.requireAuth;
  g.getOptionalUser = auth.getOptionalUser;
  g.requireVisibleProfile = (await import('../../../utils/profileAccess')).requireVisibleProfile;
  g.setResponseHeader = (): void => {};
  g.setHeader = (): void => {};
  g.sendRedirect = (_e: unknown, to: string): string => `redirect:${to}`;
  g.useRuntimeConfig = () => ({ public: { siteUrl: 'https://test.example' } });
  harness.config = { instance: { domain: 'test.example', name: 'Test' } };

  db = await createTestDB();
  harness.db = db;
  const stamp = Date.now();
  for (const [key, vis] of [['pub', 'public'], ['mem', 'members'], ['priv', 'private'], ['viewer', 'public']] as Array<[string, Vis]>) {
    const u = await createTestUser(db, { username: `${key}${stamp}`, displayName: `Name ${key}` });
    await db.update(users).set({ profileVisibility: vis, bio: `Bio of ${key}` }).where(eq(users.id, u.id));
    ids[key] = u.id;
    names[key] = u.username;
  }
  // Everyone follows pub, so pub's follower list holds one of each setting.
  for (const k of ['mem', 'priv', 'viewer']) await followUser(db, ids[k]!, ids.pub!);

  h.profile = (await import('../[username].get')).default as unknown as Handler;
  h.content = (await import('../[username]/content.get')).default as unknown as Handler;
  h.followers = (await import('../[username]/followers.get')).default as unknown as Handler;
  h.following = (await import('../[username]/following.get')).default as unknown as Handler;
  h.learning = (await import('../[username]/learning.get')).default as unknown as Handler;
  h.follow = (await import('../[username]/follow.post')).default as unknown as Handler;
  h.people = (await import('../index.get')).default as unknown as Handler;
  h.actor = (await import('../../../routes/users/[username]')).default as unknown as Handler;
  h.apFollowers = (await import('../../../routes/users/[username]/followers')).default as unknown as Handler;
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
  vi.restoreAllMocks();
});

const code = async (handler: Handler, e: ReturnType<typeof makeEvent>): Promise<number> => (await expectStatus(handler, e))?.statusCode ?? 200;

// Who may see whose profile: [viewer][target].
const MATRIX: Array<[string | null, string, number]> = [
  [null, 'pub', 200], [null, 'mem', 404], [null, 'priv', 404],
  ['viewer', 'pub', 200], ['viewer', 'mem', 200], ['viewer', 'priv', 404],
  ['priv', 'priv', 200], ['mem', 'mem', 200],
];

describe.each(['profile', 'content', 'followers', 'following', 'learning'])('GET /api/users/:username %s', (route) => {
  it.each(MATRIX)('viewer %s -> %s is %i', async (viewer, target, expected) => {
    expect(await code(h[route]!, as(viewer, { username: names[target]! }))).toBe(expected);
  });
});

describe('the hidden answer is indistinguishable from no account', () => {
  it('same status and message as a username that does not exist', async () => {
    const hidden = await expectStatus(h.profile!, as(null, { username: names.priv! }));
    const missing = await expectStatus(h.profile!, as(null, { username: 'no-such-member' }));
    expect([hidden?.statusCode, hidden?.statusMessage]).toEqual([missing?.statusCode, missing?.statusMessage]);
  });

  it('you cannot follow a profile you cannot see', async () => {
    expect(await code(h.follow!, as('viewer', { username: names.priv! }))).toBe(404);
  });
});

describe('lists of people', () => {
  const listed = (res: unknown): string[] =>
    ((res as { items: Array<{ id: string }> }).items).map((i) => Object.keys(ids).find((k) => ids[k] === i.id)!).sort();

  it('a follower list shows only the people this viewer may see', async () => {
    expect(listed(await h.followers!(as(null, { username: names.pub! })))).toEqual(['viewer']);
    expect(listed(await h.followers!(as('viewer', { username: names.pub! })))).toEqual(['mem', 'viewer']);
    expect(listed(await h.followers!(as('priv', { username: names.pub! })))).toEqual(['mem', 'priv', 'viewer']);
  });

  it('the Explore people list hides private members from everyone else', async () => {
    const anon = listed(await h.people!(as(null)));
    expect(anon).toContain('pub');
    expect(anon).not.toContain('mem');
    expect(anon).not.toContain('priv');
    const member = listed(await h.people!(as('viewer')));
    expect(member).toContain('mem');
    expect(member).not.toContain('priv');
  });
});

describe('federation', () => {
  const AP = { accept: 'application/activity+json' };
  it('a public profile publishes its name and bio', async () => {
    const doc = (await h.actor!(as(null, { username: names.pub! }, {}, AP))) as { name: string; summary: string };
    expect(doc.name).toBe('Name pub');
    expect(doc.summary).toBe('Bio of pub');
  });

  it('a hidden profile keeps its actor (posts still federate) but not its name or bio', async () => {
    for (const k of ['mem', 'priv']) {
      const doc = (await h.actor!(as(null, { username: names[k]! }, {}, AP))) as { name: string; summary: string; inbox: string };
      expect(doc.inbox).toContain(`/users/${names[k]}/inbox`);
      expect(doc.name).toBe(names[k]);
      expect(doc.summary).toBe('');
    }
  });
});

describe('every per-user API route calls the gate', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, '..', '[username]');
  // Writes on the member themself, or a gate of their own with its own tests.
  const EXEMPT = new Set(['follow.delete.ts', 'persona.get.ts']);
  it('walks the files and finds the gate in each', () => {
    const files = [join(here, '..', '[username].get.ts'), ...readdirSync(dir).map((f) => join(dir, f))]
      .filter((f) => statSync(f).isFile() && !EXEMPT.has(f.split('/').pop()!));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).toContain('await requireVisibleProfile(event, username)');
    // persona.get.ts enforces the same rule through canViewProfile directly.
    expect(readFileSync(join(dir, 'persona.get.ts'), 'utf8')).toContain('canViewProfile(target, viewer?.id)');
  });
});
