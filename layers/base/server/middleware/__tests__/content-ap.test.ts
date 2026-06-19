/**
 * Visibility-leak proving test for the content-AP dereference middleware
 * (audit session 204 — P0).
 *
 * BEFORE the fix, an unauthenticated `Accept: application/activity+json` request
 * for `/u/{user}/{type}/{slug}` returned the full AP Article for ANY published
 * item, including `members`/`private` visibility ones. The fix adds
 * `eq(contentItems.visibility, 'public')` to the WHERE so only public content is
 * dereferenceable over ActivityPub.
 *
 * This drives the REAL middleware handler against a REAL (PGlite) database seeded
 * via the server test helpers, stubbing only the Nitro auto-imports the handler
 * reads (useDB/useConfig/getRequestURL/getRequestHeader/setResponseHeader/
 * defineEventHandler/createError) on globalThis.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { H3Event } from 'h3';
import {
  createTestDB,
  createTestUser,
} from '../../../../../packages/server/src/__tests__/helpers/testdb';
import { contentItems } from '@commonpub/schema';
import type { DB } from '../../../../../packages/server/src/types';

const DOMAIN = 'app.example';

// Per-request state read by the stubbed auto-imports.
let reqPath: string;
let db: DB;

{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: { statusCode: number; statusMessage: string }): Error => {
    const e = new Error(opts.statusMessage);
    return e;
  };
  g.getRequestHeader = (_event: H3Event, name: string): string | undefined =>
    name.toLowerCase() === 'accept' ? 'application/activity+json' : undefined;
  g.getRequestURL = (_event: H3Event): URL => new URL(`https://${DOMAIN}${reqPath}`);
  g.setResponseHeader = (): void => {};
  g.useConfig = (): { features: { federation: boolean }; instance: { domain: string } } => ({
    features: { federation: true },
    instance: { domain: DOMAIN },
  });
  g.useDB = (): DB => db;
}

const handlerMod = await import('../content-ap');
const handler = handlerMod.default as (event: H3Event) => Promise<unknown>;

const fakeEvent = {} as H3Event;

beforeAll(async () => {
  db = await createTestDB();
  const author = await createTestUser(db, { username: 'maker' });
  await db.insert(contentItems).values([
    {
      authorId: author.id,
      type: 'blog',
      title: 'Public Post',
      slug: 'public-post',
      status: 'published',
      visibility: 'public',
      content: [],
    },
    {
      authorId: author.id,
      type: 'blog',
      title: 'Members Only',
      slug: 'members-only',
      status: 'published',
      visibility: 'members',
      content: [],
    },
    {
      authorId: author.id,
      type: 'blog',
      title: 'Private Post',
      slug: 'private-post',
      status: 'published',
      visibility: 'private',
      content: [],
    },
  ] as never);
}, 30_000); // PGlite pushSchema is heavy; generous setup timeout under parallel load

describe('content-ap middleware — only PUBLIC content is dereferenceable over AP', () => {
  it('serves an AP Article for a published PUBLIC item', async () => {
    reqPath = '/u/maker/blog/public-post';
    const result = (await handler(fakeEvent)) as { type?: string; name?: string } | undefined;
    expect(result).toBeDefined();
    expect(result?.type).toBe('Article');
    expect(result?.name).toBe('Public Post');
  });

  it('does NOT serve a published MEMBERS-only item (returns undefined)', async () => {
    reqPath = '/u/maker/blog/members-only';
    const result = await handler(fakeEvent);
    expect(result).toBeUndefined();
  });

  it('does NOT serve a published PRIVATE item (returns undefined)', async () => {
    reqPath = '/u/maker/blog/private-post';
    const result = await handler(fakeEvent);
    expect(result).toBeUndefined();
  });
});
