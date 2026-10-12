/**
 * Session 260 follow-up: addresses in the organizer exports.
 *
 * An `address` answer is stored as a JSON string ({"line1":…,"city":…}). Both
 * CSV exports wrote that string into one cell, so the organizer shipping dev kits
 * got `{"line1":"1039 South Fair Play Way","city":"Aurora",…}` per row. Exports now
 * split an address into one column per part plus a ready-to-paste mailing label,
 * and a SHIPPING export carries only who + how to reach them + where. Works on
 * answers already stored: nothing about the stored value changes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contests } from '@commonpub/schema';
import type { FormField, ContestSubmissionTemplateField } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { registerForContest } from '../contest/registrations.js';
import { buildRegistrantsExport, buildContestExport } from '../contest/export.js';
import { formatAddressLines, parseAddressValue } from '../contest/address.js';
import { createContest, transitionContestStatus } from '../contest/contest.js';
import { submitContestProposal } from '../contest/submissions.js';
import { contestRegistrationPrivateFields, contestEntries, contestEntryPrivateFields } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

const cfg = { features: {}, instance: { domain: 'test.example', name: 'Test' } } as unknown as CommonPubConfig;

const TEMPLATE: FormField[] = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'country', label: 'Country of residence', type: 'select', required: true, options: [{ value: 'us', label: 'US' }] },
  { key: 'recipient', label: 'Recipient', type: 'text', required: true, pii: true },
  { key: 'phone', label: 'Phone', type: 'tel', required: true, pii: true },
  { key: 'ship', label: 'Shipping address', type: 'address', required: true },
  { key: 'doc', label: 'Verification', type: 'file', required: false },
];

const ADDR = JSON.stringify({ line1: '1039 South Fair Play Way', line2: 'Unit 4', city: 'Aurora', region: 'CO', postal: '80012', country: 'USA' });

/** Parse a CSV produced by toCsv (quoted fields, CRLF rows) into rows of cells. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]!;
    if (q) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r' && csv[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}
const col = (rows: string[][], name: string): string => rows[1]![rows[0]!.indexOf(name)] ?? `<<no column ${name}>>`;

describe('address formatting', () => {
  it('formats the stored JSON into mailing lines', () => {
    expect(formatAddressLines(ADDR)).toEqual(['1039 South Fair Play Way', 'Unit 4', 'Aurora, CO 80012', 'USA']);
  });
  it('drops empty parts and copes with a missing region or postal code', () => {
    expect(formatAddressLines(JSON.stringify({ line1: 'House 17', city: 'Islamabad', country: 'Pakistan' }))).toEqual(['House 17', 'Islamabad', 'Pakistan']);
  });
  it('keeps a legacy plain-text value as line 1 instead of losing it', () => {
    expect(parseAddressValue('12 Main St, Springfield')).toEqual({ line1: '12 Main St, Springfield' });
    expect(formatAddressLines('12 Main St, Springfield')).toEqual(['12 Main St, Springfield']);
  });
  it('treats empty as empty', () => {
    expect(formatAddressLines('')).toEqual([]);
    expect(parseAddressValue(undefined)).toEqual({});
  });
});

describe('registrant exports with addresses', () => {
  let db: DB;
  let organizerId: string;
  let contestId: string;
  let username: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: `addr-org-${Date.now()}` })).id;
    const [row] = await db.insert(contests).values({
      title: 'Address Contest', slug: `addr-${crypto.randomUUID().slice(0, 8)}`,
      startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'),
      status: 'active', createdById: organizerId, registrationTemplate: TEMPLATE,
    }).returning({ id: contests.id });
    contestId = row!.id;
    const u = await createTestUser(db, { username: `addr-ent-${Date.now()}` });
    username = u.username;
    await registerForContest(db, cfg, {
      contestId, userId: u.id,
      fields: { name: 'Jasiah Jones', email: 'j@example.com', country: 'us', recipient: 'Jasiah Jones', phone: '720-643-9134', ship: ADDR },
    });
    // A second registrant whose address predates structured storage (plain text).
    const legacy = await createTestUser(db, { username: `addr-legacy-${Date.now()}` });
    await registerForContest(db, cfg, {
      contestId, userId: legacy.id,
      fields: { name: 'Old Timer', email: 'o@example.com', country: 'us', recipient: 'Old Timer', phone: '303-555-0101', ship: ADDR },
    });
    await db.update(contestRegistrationPrivateFields)
      .set({ fields: { email: 'o@example.com', recipient: 'Old Timer', phone: '303-555-0101', ship: '12 Main St, Springfield' } })
      .where(eq(contestRegistrationPrivateFields.userId, legacy.id));
  });
  afterAll(async () => { await closeTestDB(db); });

  it('splits an address into one column per part plus a mailing label, never raw JSON', async () => {
    const out = (await buildRegistrantsExport(db, contestId, true))!;
    expect(out.csv).not.toContain('{"line1"');
    const rows = parseCsv(out.csv.replace(/^\uFEFF/, ''));
    const me = [rows[0]!, rows.find((r) => r[0] === username)!];
    expect(col(me, 'Shipping address: Address line 1')).toBe('1039 South Fair Play Way');
    expect(col(me, 'Shipping address: Address line 2')).toBe('Unit 4');
    expect(col(me, 'Shipping address: City')).toBe('Aurora');
    expect(col(me, 'Shipping address: State / region')).toBe('CO');
    expect(col(me, 'Shipping address: Postal code')).toBe('80012');
    expect(col(me, 'Shipping address: Country')).toBe('USA');
    expect(col(me, 'Shipping address (mailing label)')).toBe('1039 South Fair Play Way\nUnit 4\nAurora, CO 80012\nUSA');
    // The old single column is gone.
    expect(rows[0]).not.toContain('Shipping address');
  });

  it('keeps a legacy plain-text address in line 1', async () => {
    const rows = parseCsv((await buildRegistrantsExport(db, contestId, true))!.csv.replace(/^\uFEFF/, ''));
    const legacy = [rows[0]!, rows.find((r) => r[1] === 'Old Timer' || r.includes('Old Timer'))!];
    expect(col(legacy, 'Shipping address: Address line 1')).toBe('12 Main St, Springfield');
  });

  it('without contest.pii no address column or value appears at all', async () => {
    const out = (await buildRegistrantsExport(db, contestId, false))!;
    expect(out.csv).not.toContain('Shipping address');
    expect(out.csv).not.toContain('Fair Play');
    expect(out.csv).not.toContain('720-643-9134');
  });

  it('the shipping list has who, how to reach them and where, and nothing else', async () => {
    const out = (await buildRegistrantsExport(db, contestId, true, { format: 'shipping' }))!;
    expect(out.filename).toMatch(/-shipping\.csv$/);
    const rows = parseCsv(out.csv.replace(/^\uFEFF/, ''));
    // Contact-type fields in form order (short text, email, phone, address),
    // public or private: an official name is often a plain public text field.
    expect(rows[0]).toEqual([
      'Username', 'Name', 'Full name', 'Email', 'Recipient', 'Phone',
      'Shipping address: Address line 1', 'Shipping address: Address line 2', 'Shipping address: City',
      'Shipping address: State / region', 'Shipping address: Postal code', 'Shipping address: Country',
      'Shipping address (mailing label)',
    ]);
    // Non-contact answers (country select, files) are not in a shipping list.
    expect(rows[0]).not.toContain('Country of residence');
    expect(rows[0]).not.toContain('Verification');
  });

  it('the shipping list without contest.pii carries no personal data', async () => {
    const out = (await buildRegistrantsExport(db, contestId, false, { format: 'shipping' }))!;
    expect(parseCsv(out.csv.replace(/^\uFEFF/, ''))[0]).toEqual(['Username', 'Name', 'Full name']);
    expect(out.csv).not.toContain('Fair Play');
  });

  it('file answers become absolute links when a base URL is given', async () => {
    const u = await createTestUser(db, { username: `addr-file-${Date.now()}` });
    await registerForContest(db, cfg, {
      contestId, userId: u.id,
      fields: { name: 'F', email: 'f@example.com', country: 'us', recipient: 'F', phone: '303-555-0102', ship: ADDR },
    });
    const fileId = crypto.randomUUID();
    await db.update(contestRegistrationPrivateFields)
      .set({ fields: { email: 'f@example.com', recipient: 'F', phone: '303-555-0102', ship: ADDR, doc: fileId } })
      .where(eq(contestRegistrationPrivateFields.userId, u.id));
    const out = (await buildRegistrantsExport(db, contestId, true, { baseUrl: 'https://deveco.io/' }))!;
    expect(out.csv).toContain(`https://deveco.io/api/files/${fileId}/raw`);
  });
});

describe('entries export with an address in the proposal form', () => {
  let db: DB;
  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('splits a PII address answer into labelled columns', async () => {
    const org = (await createTestUser(db, { username: `ent-addr-org-${Date.now()}` })).id;
    const FORM: ContestSubmissionTemplateField[] = [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'mail', label: 'Mailing address', type: 'address', required: true },
    ];
    const contest = await createContest(db, {
      title: 'Entry Address', slug: `ent-addr-${Date.now()}`, createdBy: org,
      startDate: new Date('2026-01-01').toISOString(), endDate: new Date('2026-12-01').toISOString(),
      stages: [{ id: 'p', name: 'Proposals', kind: 'submission', submissionMode: 'proposal', submissionTemplate: FORM }, { id: 'r', name: 'Review', kind: 'review' }],
      currentStageId: 'p',
    });
    await transitionContestStatus(db, contest.id, org, 'active');
    const e = await createTestUser(db, { username: `ent-addr-e-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'p', fields: { title: 'Pump', mail: ADDR }, userId: e.id });
    expect(res.ok).toBe(true);
    const out = (await buildContestExport(db, contest.id, true, { baseUrl: 'https://deveco.io' }))!;
    expect(out.csv).not.toContain('{"line1"');
    const rows = parseCsv(out.csv);
    expect(col(rows, 'Mailing address: City')).toBe('Aurora');
    expect(col(rows, 'Mailing address (mailing label)')).toContain('Aurora, CO 80012');
    expect(col(rows, 'Entry URL')).toMatch(/^https:\/\/deveco\.io\/contests\//);
  });

  it('keeps two address groups apart when two stages reuse the same label', async () => {
    const org = (await createTestUser(db, { username: `ent-dup-org-${Date.now()}` })).id;
    const FORM: ContestSubmissionTemplateField[] = [{ key: 'mail', label: 'Mailing address', type: 'address', required: true }];
    const FINAL: ContestSubmissionTemplateField[] = [{ key: 'mail2', label: 'Mailing address', type: 'address', required: true }];
    const contest = await createContest(db, {
      title: 'Dup Address', slug: `ent-dup-${Date.now()}`, createdBy: org,
      startDate: new Date('2026-01-01').toISOString(), endDate: new Date('2026-12-01').toISOString(),
      stages: [
        { id: 'p', name: 'Proposals', kind: 'submission', submissionMode: 'proposal', submissionTemplate: FORM },
        { id: 'r', name: 'Review', kind: 'review' },
        { id: 'f', name: 'Finals', kind: 'submission', submissionTemplate: FINAL },
      ],
      currentStageId: 'p',
    });
    await transitionContestStatus(db, contest.id, org, 'active');
    const e = await createTestUser(db, { username: `ent-dup-e-${Date.now()}` });
    expect((await submitContestProposal(db, { contestId: contest.id, stageId: 'p', fields: { mail: ADDR }, userId: e.id })).ok).toBe(true);
    const [entry] = await db.select({ id: contestEntries.id }).from(contestEntries).where(eq(contestEntries.contestId, contest.id));
    const moved = JSON.stringify({ line1: '18 Furstenwalder Str.', city: 'Berlin', postal: '10243', country: 'Germany' });
    await db.update(contestEntryPrivateFields).set({ fields: { mail: ADDR, mail2: moved } }).where(eq(contestEntryPrivateFields.entryId, entry!.id));

    const rows = parseCsv((await buildContestExport(db, contest.id, true))!.csv);
    expect(new Set(rows[0]).size).toBe(rows[0]!.length); // no duplicated headers
    expect(col(rows, 'Mailing address (mail): City')).toBe('Aurora');
    expect(col(rows, 'Mailing address (mail2): City')).toBe('Berlin');
  });
});
