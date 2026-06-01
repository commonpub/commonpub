/**
 * Load-bearing invariant for the keyset-merge (listContentKeyset):
 *   Postgres `ORDER BY id DESC` on a uuid column == JavaScript string-descending
 *   comparison of the same uuids' text form.
 *
 * Why this matters: the federated feed merges two SQL streams (content_items +
 * federated_content), each ordered `id DESC` by Postgres, using a JS comparator
 * (`a.id < b.id`) and a JS-built cursor that is fed BACK into a SQL `WHERE id < :id`
 * predicate (keysetWhere). If Postgres uuid ordering and JS string ordering ever
 * disagreed, a cursor computed in JS would mis-partition the SQL query at a
 * shared-publishedAt tie — dropping or repeating a row at the page boundary (the
 * load-more-dup class of bug). They agree because Postgres renders uuid text as
 * canonical lowercase hex with hyphens, and that form sorts identically byte-wise
 * in both engines. This test pins that so a future schema/driver change can't break
 * the merge silently.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';

describe('uuid ordering invariant: Postgres DESC == JS string DESC', () => {
  let db: DB;
  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('500 random uuids: Postgres `id DESC` order equals JS string-desc order', async () => {
    await db.execute(sql`CREATE TEMP TABLE uuid_probe (id uuid primary key default gen_random_uuid())`);
    await db.execute(sql`INSERT INTO uuid_probe SELECT gen_random_uuid() FROM generate_series(1, 500)`);
    const res = await db.execute(sql`SELECT id::text AS id FROM uuid_probe ORDER BY id DESC`);
    const pgOrder = ((res as unknown as { rows: Array<{ id: string }> }).rows).map((r) => r.id);
    const jsOrder = [...pgOrder].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

    let firstDiff = -1;
    for (let i = 0; i < pgOrder.length; i++) {
      if (pgOrder[i] !== jsOrder[i]) { firstDiff = i; break; }
    }
    expect(firstDiff, firstDiff < 0 ? '' : `diverge@${firstDiff} PG=${pgOrder[firstDiff]} JS=${jsOrder[firstDiff]}`).toBe(-1);
  });

  it('Postgres renders uuid text as canonical lowercase (the basis for the above)', async () => {
    const res = await db.execute(sql`SELECT ('A0B1C2D3-0000-0000-0000-00000000000F'::uuid)::text AS id`);
    const v = ((res as unknown as { rows: Array<{ id: string }> }).rows)[0]!.id;
    expect(v).toBe(v.toLowerCase());
  });
});
