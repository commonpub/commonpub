import { apiKeys, apiKeyUsage, users, type CreateApiKeyInput, type ApiKey } from '@commonpub/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../types.js';
import { generateApiKey } from './keys.js';
import { toAdminApiKeyView, type AdminApiKeyView } from './serializers.js';

export interface CreateApiKeyResult {
  key: AdminApiKeyView;
  /** Raw token, shown to the admin once. DO NOT log or persist. */
  token: string;
}

export async function createApiKey(
  db: DB,
  createdBy: string,
  input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
  const { token, prefix, keyHash } = generateApiKey();

  const [row] = await db
    .insert(apiKeys)
    .values({
      name: input.name,
      description: input.description ?? null,
      scopes: input.scopes,
      prefix,
      keyHash,
      createdBy,
      expiresAt: input.expiresAt ?? null,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      allowedOrigins: input.allowedOrigins ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to create API key');

  const creator = await loadUserRef(db, row.createdBy);
  return { key: toAdminApiKeyView(row, creator, null), token };
}

export async function listApiKeys(
  db: DB,
  opts: { includeRevoked?: boolean } = {},
): Promise<AdminApiKeyView[]> {
  const where = opts.includeRevoked ? undefined : isNull(apiKeys.revokedAt);
  const rows = where
    ? await db.select().from(apiKeys).where(where).orderBy(desc(apiKeys.createdAt))
    : await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));

  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.createdBy);
    if (r.revokedBy) userIds.add(r.revokedBy);
  }
  const refs = await loadUserRefs(db, Array.from(userIds));

  return rows.map((r) => toAdminApiKeyView(
    r,
    refs.get(r.createdBy) ?? null,
    r.revokedBy ? refs.get(r.revokedBy) ?? null : null,
  ));
}

export async function revokeApiKey(
  db: DB,
  keyId: string,
  revokedBy: string,
): Promise<AdminApiKeyView | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), revokedBy })
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
    .returning();
  if (!row) return null;
  const [creator, revoker] = await Promise.all([
    loadUserRef(db, row.createdBy),
    row.revokedBy ? loadUserRef(db, row.revokedBy) : Promise.resolve(null),
  ]);
  return toAdminApiKeyView(row, creator, revoker);
}

export async function getApiKeyById(db: DB, id: string): Promise<ApiKey | null> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return row ?? null;
}

/**
 * Fire-and-forget usage log. Callers should NOT await this — they should swallow
 * any rejection so a DB blip on logging never fails an API response.
 */
export async function logApiKeyUsage(
  db: DB,
  params: { keyId: string; endpoint: string; method: string; statusCode: number; latencyMs: number },
): Promise<void> {
  await db.insert(apiKeyUsage).values({
    keyId: params.keyId,
    endpoint: params.endpoint.slice(0, 200),
    method: params.method.slice(0, 10),
    statusCode: params.statusCode,
    latencyMs: params.latencyMs,
  });
}

/**
 * Debounced lastUsedAt update. We only need minute-granularity on this field
 * (admin UI just shows "5m ago"), so skipping writes within the same minute
 * saves a write per request under load.
 */
const lastUsedDebounce = new Map<string, number>();
export async function touchLastUsed(db: DB, keyId: string): Promise<void> {
  const now = Date.now();
  const prev = lastUsedDebounce.get(keyId) ?? 0;
  if (now - prev < 60_000) return;
  lastUsedDebounce.set(keyId, now);
  await db.update(apiKeys).set({ lastUsedAt: new Date(now) }).where(eq(apiKeys.id, keyId));
}

// --- helpers ---

async function loadUserRef(
  db: DB,
  userId: string,
): Promise<{ id: string; username: string; displayName: string | null } | null> {
  const [u] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

async function loadUserRefs(
  db: DB,
  userIds: string[],
): Promise<Map<string, { id: string; username: string; displayName: string | null }>> {
  const map = new Map<string, { id: string; username: string; displayName: string | null }>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users);
  const wanted = new Set(userIds);
  for (const r of rows) {
    if (wanted.has(r.id)) map.set(r.id, r);
  }
  return map;
}
