/**
 * Auth-gating proving test for `GET /api/content/:id/versions`
 * (audit session 204).
 *
 * Version history (titles, author, timestamps — incl. for unpublished drafts)
 * was world-readable for any content id. The fix requires an authenticated
 * caller AND that they be the content owner OR hold `content.moderate`.
 *
 * This drives the REAL route handler against a REAL (PGlite) DB seeded with a
 * content item + a version row. The Nitro auth auto-imports are stubbed with
 * their REAL semantics (requireAuth throws 401 when anonymous; ownerOrPermission
 * returns true iff the caller is the owner or holds the permission), reading a
 * per-test `currentUser` — so the handler's actual branch on the gate boolean
 * and the DB row's authorId is exercised.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { H3Event } from 'h3';
import {
  createTestDB,
  createTestUser,
} from '../../../../../../../packages/server/src/__tests__/helpers/testdb';
import { contentItems, contentVersions } from '@commonpub/schema';
import type { DB } from '../../../../../../../packages/server/src/types';

interface HttpError extends Error {
  statusCode: number;
}
interface TestUser {
  id: string;
  permissions: Set<string>;
}

let db: DB;
let contentId: string;
let ownerId: string;
// null => anonymous. permissions => the set the caller holds.
let currentUser: TestUser | null;

{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    return e;
  };
  // Real semantics: 401 when there is no authenticated user.
  g.requireAuth = (_event: H3Event): { id: string } => {
    if (!currentUser) {
      const e = new Error('Unauthorized') as HttpError;
      e.statusCode = 401;
      throw e;
    }
    return { id: currentUser.id };
  };
  g.useDB = (): DB => db;
  // parseParams returns the id under test (route would parse from the path).
  g.parseParams = (): { id: string } => ({ id: contentId });
  // Real semantics: owner OR permission-holder.
  g.ownerOrPermission = (_event: H3Event, resourceOwnerId: string, perm: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.id === resourceOwnerId) return true;
    return currentUser.permissions.has(perm);
  };
}

const handlerMod = await import('../versions.get');
const handler = handlerMod.default as (event: H3Event) => Promise<unknown>;
const fakeEvent = {} as H3Event;

function statusOf(p: Promise<unknown>): Promise<number | 'no-throw'> {
  return p.then(
    () => 'no-throw' as const,
    (e: HttpError) => e.statusCode,
  );
}

beforeAll(async () => {
  db = await createTestDB();
  const owner = await createTestUser(db, { username: 'owner' });
  ownerId = owner.id;
  const [item] = await db
    .insert(contentItems)
    .values({
      authorId: owner.id,
      type: 'blog',
      title: 'Draft',
      slug: 'draft',
      status: 'draft',
      visibility: 'private',
      content: [],
    } as never)
    .returning();
  contentId = (item as { id: string }).id;
  await db.insert(contentVersions).values({
    contentId,
    version: 1,
    title: 'Draft v1',
    createdById: owner.id,
  } as never);
}, 30_000); // PGlite pushSchema is heavy; generous setup timeout under parallel load

describe('versions.get — author/moderator-only', () => {
  it('anonymous caller → 401', async () => {
    currentUser = null;
    expect(await statusOf(handler(fakeEvent))).toBe(401);
  });

  it('authenticated non-owner without content.moderate → 403', async () => {
    currentUser = { id: 'some-other-user-id', permissions: new Set() };
    expect(await statusOf(handler(fakeEvent))).toBe(403);
  });

  it('owner → returns the version list', async () => {
    currentUser = { id: ownerId, permissions: new Set() };
    const result = (await handler(fakeEvent)) as Array<{ title: string | null }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0]?.title).toBe('Draft v1');
  });

  it('non-owner WITH content.moderate → returns the version list', async () => {
    currentUser = { id: 'mod-user-id', permissions: new Set(['content.moderate']) };
    const result = (await handler(fakeEvent)) as unknown[];
    expect(result.length).toBe(1);
  });
});
