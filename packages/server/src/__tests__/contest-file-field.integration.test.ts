import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { files } from '@commonpub/schema';
import type { FormField } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { validateFileFields } from '../contest/submissions.js';

// P6 file field — the DB-backed ownership/visibility/purpose/mime/size check that
// the pure validator (uuid shape only) cannot do. This is the security boundary:
// a user must not be able to reference someone else's file id, a public object, or
// a non-contest upload in a "private" field.

describe('validateFileFields (P6 DB-backed file check)', () => {
  let db: DB;
  let owner: string;
  let other: string;

  beforeAll(async () => {
    db = await createTestDB();
    owner = (await createTestUser(db, { username: 'ff-owner' })).id;
    other = (await createTestUser(db, { username: 'ff-other' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  async function makeFile(over: Partial<{ uploaderId: string; visibility: 'public' | 'private'; purpose: string; mimeType: string; sizeBytes: number }> = {}): Promise<string> {
    const [row] = await db.insert(files).values({
      uploaderId: over.uploaderId ?? owner,
      filename: 'contest/x.pdf',
      originalName: 'doc.pdf',
      mimeType: over.mimeType ?? 'application/pdf',
      sizeBytes: over.sizeBytes ?? 1024,
      storageKey: 'contest/x.pdf',
      purpose: (over.purpose ?? 'contest') as 'contest',
      visibility: over.visibility ?? 'private',
    }).returning({ id: files.id });
    return row!.id;
  }

  const tmpl = (over: Partial<FormField> = {}): FormField[] => [{ key: 'doc', label: 'Doc', type: 'file', required: false, ...over }];

  it('accepts a private contest file the user owns', async () => {
    const id = await makeFile();
    expect((await validateFileFields(db, tmpl(), { doc: id }, owner)).ok).toBe(true);
  });

  it('rejects a file owned by someone else (no id-smuggling)', async () => {
    const id = await makeFile({ uploaderId: other });
    const r = await validateFileFields(db, tmpl(), { doc: id }, owner);
    expect(r.ok).toBe(false);
  });

  it('rejects a PUBLIC or non-contest file', async () => {
    const pub = await makeFile({ visibility: 'public' });
    expect((await validateFileFields(db, tmpl(), { doc: pub }, owner)).ok).toBe(false);
    const wrong = await makeFile({ purpose: 'content' });
    expect((await validateFileFields(db, tmpl(), { doc: wrong }, owner)).ok).toBe(false);
  });

  it('rejects a non-existent file id', async () => {
    expect((await validateFileFields(db, tmpl(), { doc: '00000000-0000-0000-0000-000000000000' }, owner)).ok).toBe(false);
  });

  it('enforces the accept mime allow-list', async () => {
    const png = await makeFile({ mimeType: 'image/png' });
    expect((await validateFileFields(db, tmpl({ accept: 'application/pdf' }), { doc: png }, owner)).ok).toBe(false);
    expect((await validateFileFields(db, tmpl({ accept: 'image/*' }), { doc: png }, owner)).ok).toBe(true);
  });

  it('enforces maxSizeKb', async () => {
    const big = await makeFile({ sizeBytes: 5 * 1024 });
    expect((await validateFileFields(db, tmpl({ maxSizeKb: 2 }), { doc: big }, owner)).ok).toBe(false);
    expect((await validateFileFields(db, tmpl({ maxSizeKb: 10 }), { doc: big }, owner)).ok).toBe(true);
  });

  it('no-op when the template has no file fields', async () => {
    expect((await validateFileFields(db, [{ key: 'n', label: 'N', type: 'text', required: false }], { n: 'x' }, owner)).ok).toBe(true);
  });

  it('accepts an UPPERCASE-uuid file reference (case-insensitive) — must not falsely reject a valid file', async () => {
    // A non-standard client could submit the file id upper-cased; the uuid cast resolves
    // it, so validateFileFields must too (else the reference is rejected, or worse stored
    // in a form the orphan-sweep won't match → the sweep would delete a live file).
    const id = await makeFile();
    expect((await validateFileFields(db, tmpl(), { doc: id.toUpperCase() }, owner)).ok).toBe(true);
  });
});
