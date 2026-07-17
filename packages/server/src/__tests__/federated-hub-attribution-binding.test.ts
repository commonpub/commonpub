/**
 * §2c federation-hardening: the Announce → dereference → hub-post ingest path must
 * bind the dereferenced note's claimed author (note.attributedTo) to the note's
 * ORIGIN host (objectUri host). A trusted/mirrored hub may relay posts from any
 * instance, but it cannot vouch for an author on a host it does not control — so a
 * Note served by evil.com claiming attributedTo = alice@good.com must NOT be
 * ingested as alice's hub post (attribution forgery).
 *
 * onAnnounce dereferences objectUri over HTTP, so safeFetch is mocked here (an
 * isolated file so the module mock doesn't touch the rest of the suite).
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('../import/ssrf.js', () => ({
  safeFetch: vi.fn(),
  isPrivateUrl: () => false,
  assertPublicHost: async () => {},
}));

import { remoteActors, federatedHubs } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { followRemoteHub, listFederatedHubPosts } from '../federation/hubMirroring.js';
import { safeFetch } from '../import/ssrf.js';

const mockedSafeFetch = vi.mocked(safeFetch);
const DOMAIN = 'local.example.com';
const HUB_DOMAIN = 'remote.example.com';
const HUB_ACTOR = `https://${HUB_DOMAIN}/hubs/cool-project`;
const HUB_AUTHOR = `https://${HUB_DOMAIN}/users/alice`;

describe('§2c Announce→ingest attribution binding', () => {
  let db: DB;
  let hubId: string;
  let handlers: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    db = await createTestDB();
    await createTestUser(db, { username: 'binder' });
    await db.insert(remoteActors).values([
      { actorUri: HUB_ACTOR, inbox: `${HUB_ACTOR}/inbox`, actorType: 'Group', instanceDomain: HUB_DOMAIN, preferredUsername: 'cool-project', displayName: 'Cool Project Hub' },
      { actorUri: HUB_AUTHOR, inbox: `${HUB_AUTHOR}/inbox`, instanceDomain: HUB_DOMAIN, preferredUsername: 'alice', displayName: 'Alice' },
    ]);
    const hub = await followRemoteHub(db, HUB_ACTOR, { originDomain: HUB_DOMAIN, remoteSlug: 'cool-project', name: 'Cool Project Hub', hubType: 'community' });
    hubId = hub.id;
    // Promote to an accepted (actively-mirrored) hub so onAnnounce ingests its posts.
    await db.update(federatedHubs).set({ status: 'accepted', isHidden: false }).where(eq(federatedHubs.id, hubId));
    handlers = createInboxHandlers({ db, domain: DOMAIN, autoAcceptFollows: true });
  });

  afterAll(async () => { await closeTestDB(db); });

  it('REJECTS a note whose attributedTo host differs from the note origin host (forgery)', async () => {
    const forgedUri = `https://${HUB_DOMAIN}/notes/forged`;
    // The hub serves a note claiming a THIRD-party author on victim.example.com.
    mockedSafeFetch.mockResolvedValueOnce({
      html: JSON.stringify({ id: forgedUri, type: 'Note', content: '<p>forged</p>', attributedTo: 'https://victim.example.com/users/victim' }),
    } as never);

    await handlers.onAnnounce(HUB_ACTOR, forgedUri);

    const { items } = await listFederatedHubPosts(db, hubId);
    expect(items.find((p) => p.objectUri === forgedUri)).toBeUndefined();
  });

  it('INGESTS a note whose attributedTo lives on the same host that served it (legit relay)', async () => {
    const legitUri = `https://${HUB_DOMAIN}/notes/legit`;
    mockedSafeFetch.mockResolvedValueOnce({
      html: JSON.stringify({ id: legitUri, type: 'Note', content: '<p>legit</p>', attributedTo: HUB_AUTHOR }),
    } as never);

    await handlers.onAnnounce(HUB_ACTOR, legitUri);

    const { items } = await listFederatedHubPosts(db, hubId);
    expect(items.find((p) => p.objectUri === legitUri)).toBeDefined();
  });
});
