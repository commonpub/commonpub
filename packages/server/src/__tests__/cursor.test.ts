import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { encodeCursor, decodeCursor, asDateUuidCursor, keysetWhere, type KeysetCursor } from '../query.js';

/** base64url-encode an arbitrary cursor payload (to forge malformed cursors). */
function forge(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

describe('keyset cursor encode/decode (pure)', () => {
  it('round-trips a Date sort value (carried as ISO string)', () => {
    const d = new Date('2026-01-01T12:00:00.000Z');
    expect(decodeCursor(encodeCursor(d, 'id-1'))).toEqual({ v: d.toISOString(), id: 'id-1' });
  });

  it('round-trips a numeric sort value', () => {
    expect(decodeCursor(encodeCursor(42, 'id-2'))).toEqual({ v: 42, id: 'id-2' });
  });

  it('round-trips a null sort value (NULLS-LAST tail)', () => {
    expect(decodeCursor(encodeCursor(null, 'id-3'))).toEqual({ v: null, id: 'id-3' });
  });

  it('produces a url-safe opaque token (no +, /, =)', () => {
    const c = encodeCursor(new Date('2026-06-15T08:30:00.000Z'), 'abc-def-ghi');
    expect(c).not.toMatch(/[+/=]/);
  });

  it('returns null for every structurally-malformed cursor (caller falls back to first page)', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
    // valid base64url but not JSON
    expect(decodeCursor(Buffer.from('hello', 'utf8').toString('base64url'))).toBeNull();
    // valid JSON, wrong shape (no id)
    expect(decodeCursor(forge({ v: 1 }))).toBeNull();
    // valid JSON, wrong shape (no v)
    expect(decodeCursor(forge({ id: 'x' }))).toBeNull();
  });

  it('rejects SEMANTICALLY-invalid cursors that would otherwise reach SQL and 500', () => {
    // String v that isn't a parseable date (encodeCursor only emits ISO strings) →
    // would hit `new Date("garbage").toISOString()` RangeError in keysetWhere.
    expect(decodeCursor(forge({ v: 'garbage', id: '00000000-0000-0000-0000-000000000000' }))).toBeNull();
    expect(decodeCursor(forge({ v: 'not-a-date', id: 'abc' }))).toBeNull();
    // Non-finite numeric v (NaN serialises to null, but ±Infinity → null too via JSON;
    // guard anyway against a number that's out of Date range when used as a date sort).
    expect(decodeCursor(forge({ v: 'Infinity', id: 'x' }))).toBeNull();
    // empty-string id
    expect(decodeCursor(forge({ v: null, id: '' }))).toBeNull();
    // A VALID date string + numeric id still decodes (shape OK) — domain check is the caller's:
    expect(decodeCursor(forge({ v: '2026-01-01T00:00:00.000Z', id: 7 }))).toEqual({ v: '2026-01-01T00:00:00.000Z', id: 7 });
  });

  it('asDateUuidCursor narrows to date-or-null v + uuid id (the content feed shape)', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    // valid: null v + uuid
    expect(asDateUuidCursor({ v: null, id: uuid })).toEqual({ v: null, id: uuid });
    // valid: date-string v + uuid
    expect(asDateUuidCursor({ v: '2026-01-01T00:00:00.000Z', id: uuid })).toEqual({ v: '2026-01-01T00:00:00.000Z', id: uuid });
    // reject: numeric v (would bind a number against a timestamp column → 500)
    expect(asDateUuidCursor({ v: 42, id: uuid })).toBeNull();
    // reject: non-uuid id (would bind against a uuid column → 500)
    expect(asDateUuidCursor({ v: null, id: 'not-a-uuid' })).toBeNull();
    expect(asDateUuidCursor({ v: null, id: 7 })).toBeNull();
    // null cursor passes through
    expect(asDateUuidCursor(null)).toBeNull();
  });
});

describe('keysetWhere — paged walk equals a full ordered scan', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('reproduces ORDER BY publishedAt DESC NULLS LAST, id DESC with no dups/gaps', async () => {
    const author = await createTestUser(db, { username: 'keyset', email: 'keyset@test.dev' });

    const rows: Array<typeof contentItems.$inferInsert> = [];
    // 10 distinct timestamps (newest -> oldest)
    for (let i = 0; i < 10; i++) {
      const day = String(10 + i).padStart(2, '0');
      rows.push({ authorId: author.id, type: 'project', title: `D${i}`, slug: `d-${i}`, status: 'published', publishedAt: new Date(`2026-03-${day}T00:00:00.000Z`) });
    }
    // 6 rows sharing ONE timestamp -> exercises the id tiebreaker
    const tie = new Date('2026-02-01T00:00:00.000Z');
    for (let i = 0; i < 6; i++) {
      rows.push({ authorId: author.id, type: 'project', title: `T${i}`, slug: `t-${i}`, status: 'published', publishedAt: tie });
    }
    // 4 rows with NULL publishedAt -> NULLS LAST tail + tiebreaker among nulls
    for (let i = 0; i < 4; i++) {
      rows.push({ authorId: author.id, type: 'project', title: `N${i}`, slug: `n-${i}`, status: 'published', publishedAt: null });
    }
    await db.insert(contentItems).values(rows);

    const order = [sql`${contentItems.publishedAt} DESC NULLS LAST`, desc(contentItems.id)];
    const base = and(eq(contentItems.authorId, author.id), isNull(contentItems.deletedAt));

    // Ground truth: one big ordered scan.
    const full = await db
      .select({ id: contentItems.id, publishedAt: contentItems.publishedAt })
      .from(contentItems)
      .where(base)
      .orderBy(...order);
    const expected = full.map((r) => r.id);
    expect(expected.length).toBe(20);

    // Walk the same order in pages using only keysetWhere. Several page sizes so
    // boundaries land inside the tie-block AND inside the null tail (exercises the
    // cursor.v === null branch). The cursor is built exactly as the endpoint will:
    // encode the last row's (sortValue, id), then decode it back (round-trips the wire).
    async function walk(pageSize: number): Promise<string[]> {
      const ids: string[] = [];
      let cursor: KeysetCursor | null = null;
      for (let guard = 0; guard < 100; guard++) {
        const where = cursor
          ? and(base, keysetWhere(contentItems.publishedAt, contentItems.id, cursor))
          : base;
        const page = await db
          .select({ id: contentItems.id, publishedAt: contentItems.publishedAt })
          .from(contentItems)
          .where(where)
          .orderBy(...order)
          .limit(pageSize);
        if (page.length === 0) break;
        for (const r of page) ids.push(r.id);
        const last = page[page.length - 1]!;
        cursor = decodeCursor(encodeCursor(last.publishedAt, last.id));
        if (page.length < pageSize) break;
      }
      return ids;
    }

    for (const size of [3, 4, 7, 20]) {
      const walked = await walk(size);
      expect(walked, `pageSize=${size} order`).toEqual(expected);
      expect(new Set(walked).size, `pageSize=${size} no dups`).toBe(expected.length);
    }
  });
});
