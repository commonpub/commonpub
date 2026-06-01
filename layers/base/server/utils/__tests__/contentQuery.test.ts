/**
 * Tests for resolveContentQuery — the shared auth/status/visibility/federation gate
 * used by BOTH content list endpoints (offset `api/content/index.get.ts` and keyset
 * `api/content/feed.get.ts`). Centralising the gate is a security measure: the two
 * endpoints must not drift on what a non-owner can see. These lock that gate.
 *
 * Plus a static contract test that both endpoints actually route through the helper
 * (a future edit that inlines its own filters on one endpoint would silently reopen
 * the draft-leak hole that PUBLIC_STATUSES closed).
 *
 * `getOptionalUser` / `useConfig` are Nitro auto-imports referenced as globals; we
 * install stand-ins on globalThis (the layer's vitest env resolves free identifiers
 * from globalThis) — same approach as requirePermission.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { H3Event } from 'h3';
import type { ContentFilters } from '@commonpub/schema';

interface FakeUser { id: string; username: string; role: string }

let configStub: {
  features: { seamlessFederation: boolean };
  instance: { contentTypes: string[] };
};

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.getOptionalUser = (event: H3Event): FakeUser | null =>
    (event.context.auth?.user as FakeUser | undefined) ?? null;
  g.useConfig = () => configStub;
});

const { resolveContentQuery } = await import('../contentQuery');

function makeEvent(user: FakeUser | null): H3Event {
  return { context: { auth: { user, session: user ? {} : null } } } as unknown as H3Event;
}

describe('resolveContentQuery — non-owner status/visibility gate', () => {
  beforeAll(() => {
    configStub = { features: { seamlessFederation: false }, instance: { contentTypes: ['blog', 'project'] } };
  });

  it('forces status=published + visibility=public for an anonymous request', () => {
    const { filters } = resolveContentQuery(makeEvent(null), { status: 'draft', visibility: 'private' } as ContentFilters);
    expect(filters.status).toBe('published');
    expect(filters.visibility).toBe('public');
  });

  it('coerces any non-public status (draft/scheduled) to published for a non-owner', () => {
    for (const status of ['draft', 'scheduled', 'deleted'] as const) {
      const { filters } = resolveContentQuery(
        makeEvent({ id: 'u1', username: 'a', role: 'member' }),
        { status, authorId: 'someone-else' } as unknown as ContentFilters,
      );
      expect(filters.status, `status=${status}`).toBe('published');
      expect(filters.visibility).toBe('public');
    }
  });

  it('allows archived (a public status) through for a non-owner', () => {
    const { filters } = resolveContentQuery(makeEvent(null), { status: 'archived' } as ContentFilters);
    expect(filters.status).toBe('archived');
  });

  it('lets an OWNER see their own drafts + chosen visibility', () => {
    const { filters } = resolveContentQuery(
      makeEvent({ id: 'me', username: 'me', role: 'member' }),
      { status: 'draft', visibility: 'private', authorId: 'me' } as ContentFilters,
    );
    expect(filters.status).toBe('draft');
    expect(filters.visibility).toBe('private');
  });

  it('does NOT treat a logged-out viewer as owner even if authorId is set', () => {
    const { filters } = resolveContentQuery(
      makeEvent(null),
      { status: 'draft', authorId: 'me' } as ContentFilters,
    );
    expect(filters.status).toBe('published');
    expect(filters.visibility).toBe('public');
  });
});

describe('resolveContentQuery — federation options from config', () => {
  it('passes seamlessFederation + contentTypes through to server options', () => {
    configStub = { features: { seamlessFederation: true }, instance: { contentTypes: ['explainer'] } };
    const { options } = resolveContentQuery(makeEvent(null), {} as ContentFilters);
    expect(options.includeFederated).toBe(true);
    expect(options.allowedContentTypes).toEqual(['explainer']);
  });
});

describe('content list endpoints — both route through resolveContentQuery (no inlined gate)', () => {
  const apiDir = resolve(__dirname, '../../api/content');
  for (const file of ['index.get.ts', 'feed.get.ts']) {
    it(`${file} calls resolveContentQuery and does not inline its own status gate`, () => {
      const src = readFileSync(resolve(apiDir, file), 'utf8');
      expect(src, `${file}: must use the shared gate`).toMatch(/resolveContentQuery\s*\(/);
      // Guard against a re-inlined gate that could drift from the shared one.
      expect(src, `${file}: should not re-declare PUBLIC_STATUSES`).not.toMatch(/PUBLIC_STATUSES/);
    });
  }
});
