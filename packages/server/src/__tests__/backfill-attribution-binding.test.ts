/**
 * Audit remediation (session 241): the outbox-crawl backfill path feeds onCreate
 * with entirely attacker-controlled activities (no HTTP-signature actor pinning),
 * so a hostile mirror could list a Create whose actor + object.id both claim a
 * THIRD party's host and slip past onCreate's object.id==actor guard. backfill must
 * reject any item whose actor host != the crawled outbox owner's host.
 *
 * The outbox fetch is mocked; processInboxActivity/onCreate run for real.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

vi.mock('@commonpub/protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commonpub/protocol')>();
  const OUTBOX = {
    type: 'OrderedCollection',
    orderedItems: [
      { type: 'Create', actor: 'https://owner.example.com/users/alice',
        object: { id: 'https://owner.example.com/notes/legit', type: 'Article', name: 'Legit', content: '<p>legit</p>', attributedTo: 'https://owner.example.com/users/alice' } },
      // Forgery: actor + object.id both on victim host (consistent → passes onCreate's
      // object.id==actor guard) but NOT on the crawled outbox owner's host.
      { type: 'Create', actor: 'https://victim.example.com/users/victim',
        object: { id: 'https://victim.example.com/notes/forged', type: 'Article', name: 'Forged', content: '<p>forged</p>', attributedTo: 'https://victim.example.com/users/victim' } },
    ],
  };
  const okResp = { ok: true, status: 200, body: Buffer.from(JSON.stringify(OUTBOX)), headers: {} };
  return {
    ...actual,
    resolveActor: vi.fn(async () => ({ id: 'https://owner.example.com/actor', outbox: 'https://owner.example.com/actor/outbox' })),
    safeFetchSigned: vi.fn(async () => okResp),
    safeFetchResponse: vi.fn(async () => okResp),
  };
});

import { remoteActors } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { backfillFromOutbox } from '../federation/backfill.js';
import { listFederatedTimeline } from '../federation/timeline.js';

describe('backfill outbox-crawl attribution binding', () => {
  let db: DB;
  beforeAll(async () => {
    db = await createTestDB();
    await createTestUser(db, { username: 'crawltest' });
    // Pre-insert both actors so onCreate's resolveRemoteActor doesn't fetch.
    await db.insert(remoteActors).values([
      { actorUri: 'https://owner.example.com/users/alice', inbox: 'https://owner.example.com/users/alice/inbox', instanceDomain: 'owner.example.com', preferredUsername: 'alice' },
      { actorUri: 'https://victim.example.com/users/victim', inbox: 'https://victim.example.com/users/victim/inbox', instanceDomain: 'victim.example.com', preferredUsername: 'victim' },
    ]);
  });
  afterAll(async () => { await closeTestDB(db); });

  it('stores same-host items and rejects cross-host (forged) items from a crawled outbox', async () => {
    await backfillFromOutbox(db, 'https://owner.example.com/actor', 'local.example.com', { maxItems: 50 });

    const { items } = await listFederatedTimeline(db);
    // Legit item authored by the outbox owner is ingested.
    expect(items.find((i) => i.objectUri === 'https://owner.example.com/notes/legit')).toBeDefined();
    // Forged item (actor host != outbox owner host) is dropped before onCreate.
    expect(items.find((i) => i.objectUri === 'https://victim.example.com/notes/forged')).toBeUndefined();
  });
});
