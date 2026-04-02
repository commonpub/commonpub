/**
 * PGlite test database helper.
 * Creates an in-memory Postgres instance with the full CommonPub schema.
 * Each call returns a fresh database — no test isolation concerns.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '@commonpub/schema';
import type { DB } from '../../types.js';

/** Map of DB instances to their underlying PGlite clients for cleanup */
const clientMap = new WeakMap<object, PGlite>();

export async function createTestDB(): Promise<DB> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Apply full schema to the in-memory PGlite instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await pushSchema(schema, db as any);
  if (result.apply) {
    await result.apply();
  }

  const typedDb = db as unknown as DB;
  clientMap.set(typedDb, client);
  return typedDb;
}

/** Close the underlying PGlite connection to prevent memory leaks in test suites */
export async function closeTestDB(db: DB): Promise<void> {
  const client = clientMap.get(db);
  if (client) {
    await client.close();
    clientMap.delete(db);
  }
}

/** Create a test user directly in the database */
export async function createTestUser(
  db: DB,
  overrides: Partial<{
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: string;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const [user] = await db
    .insert(schema.users)
    .values({
      id,
      email: overrides.email ?? `test-${id.slice(0, 8)}@example.com`,
      username: overrides.username ?? `testuser-${id.slice(0, 8)}`,
      displayName: overrides.displayName ?? 'Test User',
      avatarUrl: overrides.avatarUrl ?? null,
      role: (overrides.role ?? 'member') as 'member' | 'pro' | 'verified' | 'staff' | 'admin',
    })
    .returning();
  return user!;
}
