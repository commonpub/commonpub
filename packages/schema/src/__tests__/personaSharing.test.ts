import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { userStatisticsObjections, userSharedLinks } from '../persona.js';

/**
 * Migration 0048: the statistics objection and per-platform link sharing.
 *
 * Both tables encode a decision that is invisible in the generated SQL diff once
 * it has shipped, and both decisions are the same one stated twice: **row
 * present is the whole of the state**. There is no `objected` column and no
 * `shared` column, so "off" is not a default value somebody can flip in a later
 * migration and silently opt every existing member in. Every assertion below is
 * one a later change would have to delete on purpose.
 *
 * The pairing matters too. An objection (GDPR Art. 21) and a sharing agreement
 * (consent) are opposite instruments, and the plan (R3.1 D5) keeps them out of
 * `user_purpose_consents` precisely so a digest that lapses a stale grant cannot
 * also lapse a stale refusal. These tables are where that separation lives.
 */

const objections = getTableConfig(userStatisticsObjections);
const sharedLinks = getTableConfig(userSharedLinks);

describe('user_statistics_objections', () => {
  it('is named user_statistics_objections', () => {
    expect(objections.name).toBe('user_statistics_objections');
  });

  it('has exactly two columns, and NO state column', () => {
    // A `state` or `objected` column would make two rows disagree with each
    // other, and would let a later migration set every existing member to
    // "counted" by writing a default. Row presence cannot be defaulted.
    expect(objections.columns.map((c) => c.name).sort()).toEqual(['objected_at', 'user_id']);
  });

  it('keys on user_id, so a member cannot object twice', () => {
    const userId = objections.columns.find((c) => c.name === 'user_id');
    expect(userId?.primary, 'user_id must be the primary key').toBe(true);
    expect(userId?.notNull).toBe(true);
    // A composite or surrogate key here would let a double click write a second
    // row and a withdrawal delete only one of them, leaving the member objected
    // while the UI showed them counted.
    expect(objections.primaryKeys).toHaveLength(0);
  });

  it('records WHEN the member objected, and never leaves it unset', () => {
    const objectedAt = objections.columns.find((c) => c.name === 'objected_at');
    expect(objectedAt?.notNull).toBe(true);
    expect(objectedAt?.hasDefault, 'the server never has to supply it').toBe(true);
  });

  it('cascades on delete, which IS the erasure story', () => {
    const fk = objections.foreignKeys[0]?.reference();
    expect(fk?.foreignTable, 'the objection references users').toBeDefined();
    expect(objections.foreignKeys[0]?.onDelete).toBe('cascade');
  });
});

describe('user_shared_links', () => {
  it('is named user_shared_links', () => {
    expect(sharedLinks.name).toBe('user_shared_links');
  });

  it('has exactly three columns, and NO shared flag', () => {
    expect(sharedLinks.columns.map((c) => c.name).sort()).toEqual([
      'created_at',
      'platform',
      'user_id',
    ]);
  });

  it('keys on (user_id, platform), so one platform cannot be shared twice', () => {
    const pk = sharedLinks.primaryKeys[0];
    expect(pk, 'a composite primary key, not a surrogate id').toBeDefined();
    expect(pk?.columns.map((c) => c.name)).toEqual(['user_id', 'platform']);
    // Leading with user_id is deliberate: "which platforms does this member
    // share" is the only lookup shape, and the key already serves it, so no
    // separate index exists to fall out of sync with it.
    expect(sharedLinks.indexes, 'the primary key is the only index').toHaveLength(0);
  });

  it('stores the platform KEY, capped to the key alphabet, never a URL', () => {
    const platform = sharedLinks.columns.find((c) => c.name === 'platform');
    expect(platform?.notNull).toBe(true);
    expect(platform?.getSQLType()).toBe('varchar(32)');
  });

  it('records WHEN the member first agreed, and never leaves it unset', () => {
    // First agreed, not last saved: re-ticking a platform must not rewrite the
    // date of the member's own act, which is why the writer uses
    // `onConflictDoNothing` rather than an upsert.
    const createdAt = sharedLinks.columns.find((c) => c.name === 'created_at');
    expect(createdAt?.notNull).toBe(true);
    expect(createdAt?.hasDefault).toBe(true);
  });

  it('cascades on delete, which IS the erasure story', () => {
    expect(sharedLinks.foreignKeys[0]?.onDelete).toBe('cascade');
  });
});

describe('migration 0048 is additive', () => {
  const sql = readFileSync(
    new URL('../../migrations/0048_concerned_sasquatch.sql', import.meta.url),
    'utf8',
  );

  it('read the migration and the sweep has something to walk', () => {
    // A guard needs its own guard: a broken path would make every assertion
    // below pass against an empty string.
    expect(sql.length).toBeGreaterThan(200);
    expect(sql).toContain('user_statistics_objections');
    expect(sql).toContain('user_shared_links');
  });

  it('creates exactly the two tables and alters no pre-existing one', () => {
    const created = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    expect(created.sort()).toEqual(['user_shared_links', 'user_statistics_objections']);

    // Every ALTER must be a constraint on one of the two tables this migration
    // just created. An ALTER naming any other table would mean the correction
    // touched live data, which the plan (R3.2) forbids: it is additive only.
    const altered = [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    expect(altered.length).toBeGreaterThan(0);
    for (const table of altered) {
      expect(created, `${table} is not one of the tables 0048 created`).toContain(table);
    }
  });

  it('drops nothing', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT)/i);
  });
});
