/**
 * Migration 0046 is EXECUTED here, verbatim from the file that will run on a
 * real instance.
 *
 * Every other persona integration test builds its database with `pushSchema`
 * over the Drizzle definitions in `packages/schema/src/persona.ts`, so ~2,900
 * lines of them prove properties of the table DEFINITIONS and not of the SQL.
 * If the generated migration were missing `uq_purpose_current`'s partial `WHERE`
 * predicate, an index, or an `ON DELETE CASCADE`, every one of those tests would
 * stay green and the defect would appear for the first time in production. The
 * precedent for closing that gap is `feed-indexes.integration.test.ts`, whose
 * own comment names `pushSchema` as the reason it exists.
 *
 * Two of the asserted properties are load bearing rather than cosmetic:
 *
 * - `uq_purpose_current` is what makes "current consent" a single row. Without
 *   its partial predicate the whole history collides on it and supersede-then-
 *   insert cannot work at all; with a NON-partial version, every superseded row
 *   would block a re-grant.
 * - the three `ON DELETE CASCADE` foreign keys are the ENTIRE erasure story for
 *   this feature. `packages/server/src/persona/consent.ts` states that account
 *   deletion "needs no code here at all" because of them, so if the migration
 *   ships `NO ACTION` instead, deleting an account either fails or strands the
 *   member's persona answers and their consent record.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '../../../schema/migrations/0046_jazzy_frog_thor.sql');

/** The four tables 0046 creates. Nothing else; it alters no existing table. */
const TABLES = [
  'persona_metrics_daily',
  'user_persona_answers',
  'user_persona_text',
  'user_purpose_consents',
] as const;

const INDEXES = [
  'uq_persona_metrics_daily_day_metric_dim',
  'idx_persona_metrics_daily_metric_day',
  'uq_persona_answer',
  'idx_persona_answer_field_value',
  'uq_persona_text',
  'uq_purpose_current',
  'idx_purpose_consent_lookup',
] as const;

const CASCADING_FKS = [
  'user_persona_answers_user_id_users_id_fk',
  'user_persona_text_user_id_users_id_fk',
  'user_purpose_consents_user_id_users_id_fk',
] as const;

async function rows<T>(db: DB, query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return (res as unknown as { rows: T[] }).rows;
}

describe('migration 0046, executed', () => {
  let db: DB;
  let source: string;

  beforeAll(async () => {
    source = readFileSync(MIGRATION, 'utf8');
    // `createTestDB` has already pushed the Drizzle schema, which includes these
    // four tables, so the migration is replayed against a namespace where they
    // exist. Dropping them first is what makes this an execution of the SQL
    // rather than a no-op, and it also proves the statements are self-contained.
    db = await createTestDB();
    for (const table of TABLES) {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`));
    }
    for (const statement of source.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed === '') continue;
      await db.execute(sql.raw(trimmed));
    }
  });

  afterAll(async () => { await closeTestDB(db); });

  it('guards its own guard: the migration file was read and is not empty', () => {
    // A renamed or moved file must fail red, not replay nothing and pass.
    expect(source.length).toBeGreaterThan(1500);
    expect(source.split('--> statement-breakpoint').length).toBeGreaterThan(10);
  });

  it('alters no existing table, which is what makes it non-breaking', () => {
    // Plan 14.4's net effect on the database: four CREATE TABLEs and nothing
    // else. The only ALTERs are the three FKs on its OWN new tables.
    const alters = [...source.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    expect(new Set(alters)).toEqual(
      new Set(['user_persona_answers', 'user_persona_text', 'user_purpose_consents']),
    );
  });

  it.each(TABLES)('creates %s', async (table) => {
    const found = await rows<{ n: number }>(
      db,
      sql`SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${table}`,
    );
    expect(found[0]?.n).toBe(1);
  });

  it.each(INDEXES)('creates %s', async (index) => {
    const found = await rows<{ n: number }>(
      db,
      sql`SELECT count(*)::int AS n FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = ${index}`,
    );
    expect(found[0]?.n).toBe(1);
  });

  it('makes uq_purpose_current PARTIAL on superseded_at IS NULL', async () => {
    const [row] = await rows<{ indexdef: string }>(
      db,
      sql`SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'uq_purpose_current'`,
    );
    expect(row?.indexdef).toContain('UNIQUE');
    expect(row?.indexdef.toLowerCase()).toContain('where');
    expect(row?.indexdef.toLowerCase()).toContain('superseded_at is null');
  });

  it('lets the partial index hold a full history with exactly one current row', async () => {
    // The behaviour the predicate exists for, asserted against the SHIPPED
    // index rather than the Drizzle definition.
    const [user] = await rows<{ id: string }>(
      db,
      sql`INSERT INTO users (email, username, display_name)
          VALUES ('mig0046@test.local', 'mig0046', 'Mig') RETURNING id`,
    );
    const insert = (superseded: boolean) => sql`
      INSERT INTO user_purpose_consents
        (user_id, purpose, state, scope_digest, scope_snapshot, policy_version, source, superseded_at)
      VALUES (${user!.id}, 'sponsor_sharing', 'granted', 'd', '{}'::jsonb, '1', 'settings',
              ${superseded ? sql`now()` : sql`NULL`})`;

    await db.execute(insert(true));
    await db.execute(insert(true));
    await db.execute(insert(false));
    await expect(db.execute(insert(false))).rejects.toThrow();

    const [count] = await rows<{ n: number }>(
      db,
      sql`SELECT count(*)::int AS n FROM user_purpose_consents WHERE user_id = ${user!.id}`,
    );
    expect(count?.n).toBe(3);
  });

  it.each(CASCADING_FKS)('%s cascades on delete, which IS the erasure story', async (name) => {
    const [row] = await rows<{ confdeltype: string }>(
      db,
      sql`SELECT confdeltype FROM pg_constraint WHERE conname = ${name}`,
    );
    // 'c' is CASCADE. 'a' (NO ACTION) here would either block account deletion
    // or strand a member's persona rows and their consent record.
    expect(row?.confdeltype).toBe('c');
  });

  it('deletes every persona row when the account goes, with no code in the path', async () => {
    const [user] = await rows<{ id: string }>(
      db,
      sql`INSERT INTO users (email, username, display_name)
          VALUES ('mig0046b@test.local', 'mig0046b', 'Mig B') RETURNING id`,
    );
    await db.execute(sql`
      INSERT INTO user_persona_answers (user_id, section_key, field_key, value)
      VALUES (${user!.id}, 'interests', 'interests', 'robotics')`);
    await db.execute(sql`
      INSERT INTO user_persona_text (user_id, section_key, field_key, value)
      VALUES (${user!.id}, 'basics', 'about', 'hello')`);
    await db.execute(sql`
      INSERT INTO user_purpose_consents
        (user_id, purpose, state, scope_digest, scope_snapshot, policy_version, source)
      VALUES (${user!.id}, 'sponsor_sharing', 'granted', 'd', '{}'::jsonb, '1', 'settings')`);

    await db.execute(sql`DELETE FROM users WHERE id = ${user!.id}`);

    for (const table of ['user_persona_answers', 'user_persona_text', 'user_purpose_consents']) {
      const [left] = await rows<{ n: number }>(
        db,
        sql.raw(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = '${user!.id}'`),
      );
      expect(left?.n, table).toBe(0);
    }
  });

  it('keeps persona_metrics_daily free of any user reference', async () => {
    // The rollup table holds aggregates only. A `user_id` on it would make the
    // "suppression and quantisation at write" argument meaningless.
    const cols = await rows<{ column_name: string }>(
      db,
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'persona_metrics_daily'`,
    );
    expect(cols.map((c) => c.column_name)).not.toContain('user_id');
  });

  it('defaults dimension to the empty string rather than NULL', async () => {
    // NULLs are DISTINCT in a Postgres unique index, so a nullable `dimension`
    // would silently allow duplicate rows and break the idempotent day rewrite.
    const [row] = await rows<{ is_nullable: string; column_default: string | null }>(
      db,
      sql`SELECT is_nullable, column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'persona_metrics_daily'
            AND column_name = 'dimension'`,
    );
    expect(row?.is_nullable).toBe('NO');
    expect(row?.column_default ?? '').toContain("''");
  });
});
