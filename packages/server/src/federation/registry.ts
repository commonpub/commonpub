/**
 * Instance registry / directory (Phase 4).
 *
 * When `features.actAsRegistry` is on, other CommonPub instances send a signed heartbeat to
 * `POST /api/registry/ping`. We verify the signature (proving domain ownership), then PULL the
 * pinger's public NodeInfo for authoritative, un-spoofable stats and upsert a `registry_instances`
 * row. Admin controls visibility via `status` (active | hidden | blocked).
 *
 * Client side: when `features.announceToRegistry` is on, `sendRegistryPing` periodically posts a
 * signed heartbeat to the configured `federation.registryUrl`.
 */
import { eq, and, or, ilike, desc, asc, sql } from 'drizzle-orm';
import { registryInstances } from '@commonpub/schema';
import { safeFetch, signRequest, safeFetchSigned } from '@commonpub/protocol';
import type { DB } from '../types.js';

/** Window after the last heartbeat within which an instance is considered "online". */
const ONLINE_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface RegistryInstanceView {
  id: string;
  domain: string;
  actorUri: string;
  name: string | null;
  description: string | null;
  userCount: number;
  activeMonthCount: number;
  localPostCount: number;
  features: Record<string, boolean> | null;
  softwareName: string | null;
  softwareVersion: string | null;
  status: string;
  lastPingAt: string | null;
  /** Derived: pinged within ONLINE_WINDOW_MS */
  online: boolean;
  createdAt: string;
}

/** Stats pulled from a remote instance's public NodeInfo 2.1 document. */
export interface PulledNodeInfo {
  name: string | null;
  description: string | null;
  userCount: number;
  activeMonthCount: number;
  localPostCount: number;
  features: Record<string, boolean> | null;
  softwareName: string | null;
  softwareVersion: string | null;
}

/** A function that fetches a URL and returns its body text (SSRF-guarded `safeFetch` by default). */
export type RegistryFetcher = (url: string) => Promise<{ html: string }>;
const defaultFetcher: RegistryFetcher = (url) => safeFetch(url, { timeoutMs: 10_000 });

/**
 * Pull a remote instance's public NodeInfo 2.1 document for authoritative stats.
 * SSRF-guarded (via `safeFetch`); the 2.1 link must be same-host as the domain (no cross-host
 * redirection of our fetch). Returns null on any failure (treated as "stats unavailable").
 */
export async function fetchInstanceNodeInfo(
  domain: string,
  fetcher: RegistryFetcher = defaultFetcher,
): Promise<PulledNodeInfo | null> {
  try {
    const wk = await fetcher(`https://${domain}/.well-known/nodeinfo`);
    const wkDoc = JSON.parse(wk.html) as { links?: Array<{ rel?: string; href?: string }> };
    const link = wkDoc.links?.find((l) => l.rel?.includes('nodeinfo') && l.href);
    if (!link?.href) return null;
    // The href is remote-controlled — only follow an https link on the SAME host as the pinger.
    let hrefHost: string;
    try {
      const u = new URL(link.href);
      if (u.protocol !== 'https:') return null;
      hrefHost = u.hostname;
    } catch {
      return null;
    }
    if (hrefHost !== domain) return null;

    const doc = await fetcher(link.href);
    const ni = JSON.parse(doc.html) as {
      software?: { name?: string; version?: string };
      usage?: { users?: { total?: number; activeMonth?: number }; localPosts?: number };
      metadata?: { nodeName?: string; nodeDescription?: string; features?: Record<string, boolean> };
    };
    return {
      name: ni.metadata?.nodeName ?? null,
      description: ni.metadata?.nodeDescription ?? null,
      userCount: ni.usage?.users?.total ?? 0,
      activeMonthCount: ni.usage?.users?.activeMonth ?? 0,
      localPostCount: ni.usage?.localPosts ?? 0,
      features: ni.metadata?.features ?? null,
      softwareName: ni.software?.name ?? null,
      softwareVersion: ni.software?.version ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Record a verified registry ping. The caller has already verified the HTTP signature, so `domain`
 * (derived from the verified actor) is trusted. A `blocked` instance is a no-op. Otherwise we pull
 * NodeInfo for fresh stats and upsert — preserving an admin-set `hidden` status (only a new row
 * starts `active`).
 */
export async function recordRegistryPing(
  db: DB,
  domain: string,
  actorUri: string,
  opts?: { fetchNodeInfo?: (domain: string) => Promise<PulledNodeInfo | null> },
): Promise<'recorded' | 'blocked'> {
  const [existing] = await db
    .select({ status: registryInstances.status })
    .from(registryInstances)
    .where(eq(registryInstances.domain, domain))
    .limit(1);
  if (existing?.status === 'blocked') return 'blocked';

  const pull = opts?.fetchNodeInfo ?? ((d: string) => fetchInstanceNodeInfo(d));
  const ni = await pull(domain);
  const now = new Date();

  await db
    .insert(registryInstances)
    .values({
      domain,
      actorUri,
      name: ni?.name ?? null,
      description: ni?.description ?? null,
      userCount: ni?.userCount ?? 0,
      activeMonthCount: ni?.activeMonthCount ?? 0,
      localPostCount: ni?.localPostCount ?? 0,
      features: ni?.features ?? null,
      softwareName: ni?.softwareName ?? null,
      softwareVersion: ni?.softwareVersion ?? null,
      status: 'active',
      lastPingAt: now,
    })
    .onConflictDoUpdate({
      target: registryInstances.domain,
      set: {
        actorUri,
        lastPingAt: now,
        updatedAt: now,
        // Refresh stats only when we actually pulled NodeInfo (don't zero them on a transient failure).
        ...(ni
          ? {
              name: ni.name,
              description: ni.description,
              userCount: ni.userCount,
              activeMonthCount: ni.activeMonthCount,
              localPostCount: ni.localPostCount,
              features: ni.features,
              softwareName: ni.softwareName,
              softwareVersion: ni.softwareVersion,
            }
          : {}),
        // NOTE: status is intentionally NOT set here — preserve an admin's `hidden` choice.
      },
    });

  return 'recorded';
}

export interface ListRegistryOptions {
  search?: string;
  limit: number;
  offset: number;
  /** Admin path: include hidden/blocked rows. Public path: active only. */
  includeNonActive?: boolean;
}

/** List directory entries. Public callers get `active` only; admin gets all + status. */
export async function listRegistryInstances(
  db: DB,
  opts: ListRegistryOptions,
): Promise<{ instances: RegistryInstanceView[]; total: number }> {
  const conds = [];
  if (!opts.includeNonActive) conds.push(eq(registryInstances.status, 'active'));
  if (opts.search) {
    const q = `%${opts.search.replace(/[%_]/g, '\\$&')}%`;
    conds.push(or(ilike(registryInstances.domain, q), ilike(registryInstances.name, q)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(registryInstances)
    .where(where)
    // Newest heartbeat first; `domain` (unique) is the stable tiebreaker so pages don't overlap.
    .orderBy(desc(registryInstances.lastPingAt), asc(registryInstances.domain))
    .limit(opts.limit)
    .offset(opts.offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registryInstances)
    .where(where);

  return { instances: rows.map(rowToView), total: countRow?.count ?? 0 };
}

/** Get a single directory entry by id. */
export async function getRegistryInstance(db: DB, id: string): Promise<RegistryInstanceView | null> {
  const [row] = await db.select().from(registryInstances).where(eq(registryInstances.id, id)).limit(1);
  return row ? rowToView(row) : null;
}

/** Admin: set an instance's directory status (active | hidden | blocked). */
export async function setRegistryInstanceStatus(
  db: DB,
  id: string,
  status: 'active' | 'hidden' | 'blocked',
): Promise<RegistryInstanceView | null> {
  const [row] = await db
    .update(registryInstances)
    .set({ status, updatedAt: new Date() })
    .where(eq(registryInstances.id, id))
    .returning();
  return row ? rowToView(row) : null;
}

/**
 * Client side: send a signed heartbeat to a registry. Identity is proven by the HTTP signature
 * (instance actor keyId); the registry derives our domain from it and pulls our public NodeInfo.
 */
export async function sendRegistryPing(
  db: DB,
  registryUrl: string,
  localDomain: string,
  /** Injectable signed-sender (defaults to the SSRF-safe `safeFetchSigned`) — overridden in tests. */
  send: (req: Request) => Promise<{ ok: boolean; status: number }> = (req) =>
    safeFetchSigned(req, { timeoutMs: 15_000 }),
): Promise<{ ok: boolean; status: number }> {
  const { getOrCreateInstanceKeypair } = await import('./federation.js');
  const keypair = await getOrCreateInstanceKeypair(db);
  const localActorUri = `https://${localDomain}/actor`;
  const keyId = `${localActorUri}#main-key`;
  const url = `${registryUrl.replace(/\/+$/, '')}/api/registry/ping`;

  // Non-empty body so the request carries a digest the registry can verify (it ignores the
  // body's contents — domain + stats come from the signature + a NodeInfo pull).
  const body = JSON.stringify({ actor: localActorUri });
  const request = new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `CommonPub/1.0 (+https://${localDomain})`,
    },
    body,
  });
  const signed = await signRequest(request, keypair.privateKeyPem, keyId);
  const res = await send(signed);
  return { ok: res.ok, status: res.status };
}

function rowToView(row: typeof registryInstances.$inferSelect): RegistryInstanceView {
  const lastPing = row.lastPingAt ? row.lastPingAt.getTime() : null;
  return {
    id: row.id,
    domain: row.domain,
    actorUri: row.actorUri,
    name: row.name,
    description: row.description,
    userCount: row.userCount,
    activeMonthCount: row.activeMonthCount,
    localPostCount: row.localPostCount,
    features: row.features as Record<string, boolean> | null,
    softwareName: row.softwareName,
    softwareVersion: row.softwareVersion,
    status: row.status,
    lastPingAt: row.lastPingAt?.toISOString() ?? null,
    online: lastPing != null && Date.now() - lastPing < ONLINE_WINDOW_MS,
    createdAt: row.createdAt.toISOString(),
  };
}
