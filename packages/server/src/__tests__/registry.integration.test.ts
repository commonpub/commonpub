/**
 * Registry / instance directory (Phase 4) — server logic.
 *
 * Covers NodeInfo pulling (with an injected fetcher — no network), ping recording (new/re-ping,
 * blocked no-op, hidden preserved), listing (public active-only vs admin-all, search, pagination),
 * status changes, and the signed-ping builder.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { registryInstances } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  fetchInstanceNodeInfo,
  recordRegistryPing,
  listRegistryInstances,
  setRegistryInstanceStatus,
  getRegistryInstance,
  sendRegistryPing,
  type PulledNodeInfo,
} from '../federation/registry.js';
import { getOrCreateInstanceKeypair } from '../federation/federation.js';

const WELLKNOWN = {
  links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: 'https://maker.example/nodeinfo/2.1' }],
};
const NODEINFO_DOC = {
  version: '2.1',
  software: { name: 'commonpub', version: '2.73.0' },
  usage: { users: { total: 42, activeMonth: 7 }, localPosts: 100 },
  metadata: { nodeName: 'Maker Hub', nodeDescription: 'A maker community', features: { communities: true, docs: false } },
};

/** A fetcher stub that returns canned bodies keyed by URL. */
function stubFetcher(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (!(url in map)) throw new Error(`unexpected fetch ${url}`);
    return { html: JSON.stringify(map[url]) };
  });
}

const PULLED: PulledNodeInfo = {
  name: 'Maker Hub',
  description: 'A maker community',
  userCount: 42,
  activeMonthCount: 7,
  localPostCount: 100,
  features: { communities: true, docs: false },
  softwareName: 'commonpub',
  softwareVersion: '2.73.0',
};

describe('fetchInstanceNodeInfo', () => {
  it('pulls + parses the public NodeInfo 2.1 document', async () => {
    const fetcher = stubFetcher({
      'https://maker.example/.well-known/nodeinfo': WELLKNOWN,
      'https://maker.example/nodeinfo/2.1': NODEINFO_DOC,
    });
    const ni = await fetchInstanceNodeInfo('maker.example', fetcher);
    expect(ni).toEqual(PULLED);
  });

  it('refuses a 2.1 href on a different host (anti-SSRF redirection)', async () => {
    const fetcher = stubFetcher({
      'https://maker.example/.well-known/nodeinfo': {
        links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: 'https://evil.example/nodeinfo/2.1' }],
      },
    });
    expect(await fetchInstanceNodeInfo('maker.example', fetcher)).toBeNull();
  });

  it('returns null when the fetch throws (e.g. SSRF-blocked or offline)', async () => {
    const fetcher = vi.fn(async () => { throw new Error('blocked'); });
    expect(await fetchInstanceNodeInfo('maker.example', fetcher)).toBeNull();
  });
});

describe('registry ping recording + listing', () => {
  let db: DB;
  const noopFetch = async () => null;
  const okFetch = async () => PULLED;

  beforeEach(async () => { db = await createTestDB(); });
  afterEach(async () => { await closeTestDB(db); });

  it('records a new ping as an active entry with pulled stats', async () => {
    const r = await recordRegistryPing(db, 'maker.example', 'https://maker.example/actor', { fetchNodeInfo: okFetch });
    expect(r).toBe('recorded');
    const [row] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'maker.example'));
    expect(row!.status).toBe('active');
    expect(row!.userCount).toBe(42);
    expect(row!.name).toBe('Maker Hub');
    expect(row!.lastPingAt).not.toBeNull();
  });

  it('a re-ping updates stats + lastPingAt without duplicating the row', async () => {
    await recordRegistryPing(db, 'maker.example', 'https://maker.example/actor', { fetchNodeInfo: okFetch });
    await recordRegistryPing(db, 'maker.example', 'https://maker.example/actor', {
      fetchNodeInfo: async () => ({ ...PULLED, userCount: 99 }),
    });
    const rows = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'maker.example'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userCount).toBe(99);
  });

  it('a blocked instance is a no-op (ping ignored, stays blocked)', async () => {
    await recordRegistryPing(db, 'spam.example', 'https://spam.example/actor', { fetchNodeInfo: okFetch });
    const [row] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'spam.example'));
    await setRegistryInstanceStatus(db, row!.id, 'blocked');

    const r = await recordRegistryPing(db, 'spam.example', 'https://spam.example/actor', {
      fetchNodeInfo: async () => ({ ...PULLED, userCount: 12345 }),
    });
    expect(r).toBe('blocked');
    const [after] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'spam.example'));
    expect(after!.status).toBe('blocked');
    expect(after!.userCount).not.toBe(12345); // stats not refreshed for a blocked instance
  });

  it("a re-ping preserves an admin's hidden status (does not re-activate)", async () => {
    await recordRegistryPing(db, 'hide.example', 'https://hide.example/actor', { fetchNodeInfo: okFetch });
    const [row] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'hide.example'));
    await setRegistryInstanceStatus(db, row!.id, 'hidden');

    await recordRegistryPing(db, 'hide.example', 'https://hide.example/actor', { fetchNodeInfo: okFetch });
    const [after] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'hide.example'));
    expect(after!.status).toBe('hidden');
  });

  it('still records a heartbeat when NodeInfo is unavailable (keeps prior stats)', async () => {
    await recordRegistryPing(db, 'flaky.example', 'https://flaky.example/actor', { fetchNodeInfo: okFetch });
    const before = (await db.select().from(registryInstances).where(eq(registryInstances.domain, 'flaky.example')))[0]!;
    await recordRegistryPing(db, 'flaky.example', 'https://flaky.example/actor', { fetchNodeInfo: noopFetch });
    const after = (await db.select().from(registryInstances).where(eq(registryInstances.domain, 'flaky.example')))[0]!;
    expect(after.userCount).toBe(42); // prior stats retained
    expect(after.lastPingAt!.getTime()).toBeGreaterThanOrEqual(before.lastPingAt!.getTime());
  });

  it('public listing returns only active; admin listing returns all', async () => {
    await recordRegistryPing(db, 'a.example', 'https://a.example/actor', { fetchNodeInfo: okFetch });
    await recordRegistryPing(db, 'b.example', 'https://b.example/actor', { fetchNodeInfo: okFetch });
    const [b] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'b.example'));
    await setRegistryInstanceStatus(db, b!.id, 'hidden');

    const pub = await listRegistryInstances(db, { limit: 20, offset: 0 });
    expect(pub.instances.map((i) => i.domain).sort()).toEqual(['a.example']);
    expect(pub.total).toBe(1);

    const adm = await listRegistryInstances(db, { limit: 20, offset: 0, includeNonActive: true });
    expect(adm.instances.map((i) => i.domain).sort()).toEqual(['a.example', 'b.example']);
    expect(adm.total).toBe(2);
  });

  it('search matches domain or name; pagination caps results', async () => {
    await recordRegistryPing(db, 'arduino.example', 'https://arduino.example/actor', {
      fetchNodeInfo: async () => ({ ...PULLED, name: 'Arduino Makers' }),
    });
    await recordRegistryPing(db, 'woodworking.example', 'https://woodworking.example/actor', {
      fetchNodeInfo: async () => ({ ...PULLED, name: 'Wood Shop' }),
    });
    const byName = await listRegistryInstances(db, { search: 'arduino', limit: 20, offset: 0 });
    expect(byName.instances).toHaveLength(1);
    expect(byName.instances[0]!.domain).toBe('arduino.example');

    const page = await listRegistryInstances(db, { limit: 1, offset: 0 });
    expect(page.instances).toHaveLength(1);
    expect(page.total).toBe(2);
  });

  it('derives online from lastPingAt', async () => {
    await recordRegistryPing(db, 'fresh.example', 'https://fresh.example/actor', { fetchNodeInfo: okFetch });
    const { instances } = await listRegistryInstances(db, { limit: 20, offset: 0 });
    expect(instances[0]!.online).toBe(true);
  });

  it('setRegistryInstanceStatus returns the updated view; getRegistryInstance reads it back', async () => {
    await recordRegistryPing(db, 'x.example', 'https://x.example/actor', { fetchNodeInfo: okFetch });
    const [row] = await db.select().from(registryInstances).where(eq(registryInstances.domain, 'x.example'));
    const updated = await setRegistryInstanceStatus(db, row!.id, 'hidden');
    expect(updated!.status).toBe('hidden');
    const got = await getRegistryInstance(db, row!.id);
    expect(got!.status).toBe('hidden');
  });
});

describe('sendRegistryPing', () => {
  it('builds a signed POST to {registryUrl}/api/registry/ping with a digest', async () => {
    const db = await createTestDB();
    await getOrCreateInstanceKeypair(db); // ensure a keypair exists

    let captured: Request | null = null;
    const res = await sendRegistryPing(db, 'https://registry.example/', 'me.example', async (req) => {
      captured = req;
      return { ok: true, status: 200 };
    });

    expect(res.ok).toBe(true);
    expect(captured).not.toBeNull();
    const sent = captured! as Request;
    expect(sent.url).toBe('https://registry.example/api/registry/ping'); // trailing slash collapsed
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('signature')).toContain('keyId="https://me.example/actor#main-key"');
    expect(sent.headers.get('digest')).toMatch(/^SHA-256=/); // body digest present + signed
    await closeTestDB(db);
  });
});
