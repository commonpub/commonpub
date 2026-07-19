import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  contests,
  contestRegistrations,
  contestRegistrationPrivateFields,
  contestAgreementAcceptances,
  users,
} from '@commonpub/schema';
import type { FormField } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { registerForContest, getViewerRegistration, listContestRegistrants } from '../contest/registrations.js';
import { buildRegistrantsExport } from '../contest/export.js';

// P2: registration routed through the operator's registrationTemplate — public
// answers vs PII vs consent are partitioned exactly like entry submissions, in one
// transaction, with idempotent re-register consent.

const cfg = { features: {}, instance: { domain: 'test.example', name: 'Test' } } as unknown as CommonPubConfig;

const TEMPLATE: FormField[] = [
  { key: 'sec', label: 'About you', type: 'section', required: false },
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Contact email', type: 'email', required: true }, // default-PII
  { key: 'country', label: 'Country', type: 'radio', required: true, options: [{ value: 'us', label: 'US' }, { value: 'ca', label: 'Canada' }] },
  { key: 'tos', label: 'Rules', type: 'agreement', required: true, terms: 'You agree to the rules.', mustAccept: true },
];

async function makeContest(db: DB, createdById: string, template: FormField[]): Promise<string> {
  const [row] = await db.insert(contests).values({
    title: 'Rich Reg Contest',
    slug: `rr-${crypto.randomUUID().slice(0, 8)}`,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-01T00:00:00Z'),
    status: 'active',
    createdById,
    registrationTemplate: template,
  }).returning({ id: contests.id });
  return row!.id;
}

describe('contest registration template partition (P2)', () => {
  let db: DB;
  let organizerId: string;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'rr-org' })).id;
    userId = (await createTestUser(db, { username: 'rr-user', email: 'ada@example.com' })).id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  });
  afterAll(async () => { await closeTestDB(db); });

  it('partitions public / PII / consent and stores only public in registrations.fields', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE);
    const res = await registerForContest(db, cfg, {
      contestId, userId,
      fields: { name: 'Ada Lovelace', email: 'ada@example.com', country: 'us', tos: 'true' },
      ip: '203.0.113.7',
    });
    expect(res.registered).toBe(true);

    // Public answers only (name, country) — email is default-PII, tos is consent.
    const reg = await getViewerRegistration(db, contestId, userId);
    expect(reg?.fields).toEqual({ name: 'Ada Lovelace', country: 'us' });

    // PII in the private table.
    const [priv] = await db.select().from(contestRegistrationPrivateFields)
      .where(eq(contestRegistrationPrivateFields.userId, userId));
    expect(priv?.fields).toEqual({ email: 'ada@example.com' });

    // Consent audit row, registration-scoped (entry_id null, ip captured).
    const accepts = await db.select().from(contestAgreementAcceptances)
      .where(eq(contestAgreementAcceptances.userId, userId));
    expect(accepts).toHaveLength(1);
    expect(accepts[0]!.fieldKey).toBe('tos');
    expect(accepts[0]!.registrationId).toBeTruthy();
    expect(accepts[0]!.entryId).toBeNull();
    expect(accepts[0]!.ip).toBe('203.0.113.7');
  });

  it('listContestRegistrants merges private answers ONLY when includePii is set', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE);
    await registerForContest(db, cfg, {
      contestId, userId,
      fields: { name: 'Ada Lovelace', email: 'ada@example.com', country: 'us', tos: 'true' },
    });

    // Without PII: public answers only, private omitted.
    const plain = await listContestRegistrants(db, contestId, {});
    expect(plain.items[0]!.fields).toEqual({ name: 'Ada Lovelace', country: 'us' });
    expect(plain.items[0]!.privateFields).toBeUndefined();

    // With PII: the email (default-PII) is merged in.
    const withPii = await listContestRegistrants(db, contestId, { includePii: true });
    expect(withPii.items[0]!.privateFields).toEqual({ email: 'ada@example.com' });
  });

  it('buildRegistrantsExport label-maps answers, gates PII columns, and neutralizes formulas', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE);
    await registerForContest(db, cfg, {
      contestId, userId,
      fields: { name: '=cmd()', email: 'ada@example.com', country: 'us', tos: 'true' },
    });

    // Without PII: public columns only (Full name, Country), email column absent.
    const plain = await buildRegistrantsExport(db, contestId, false);
    const plainHeader = plain!.csv.split('\r\n')[0]!;
    expect(plainHeader).toContain('Full name');
    expect(plainHeader).toContain('Country');
    expect(plainHeader).not.toContain('Contact email');
    // Formula-injection neutralization: a leading '=' is prefixed with an apostrophe
    // so a spreadsheet can't evaluate it as a formula.
    expect(plain!.csv).toContain(`'=cmd()`);
    expect(plain!.csv).not.toMatch(/,=cmd\(\)/);

    // With PII: the email column appears with the value.
    const withPii = await buildRegistrantsExport(db, contestId, true);
    expect(withPii!.csv.split('\r\n')[0]!).toContain('Contact email');
    expect(withPii!.csv).toContain('ada@example.com');
  });

  it('re-register (info edit) does NOT duplicate the consent row (idempotent dedup)', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE);
    const base = { name: 'Ada', email: 'ada@example.com', country: 'us', tos: 'true' };
    await registerForContest(db, cfg, { contestId, userId, fields: base });
    await registerForContest(db, cfg, { contestId, userId, fields: { ...base, country: 'ca' } });

    const [reg] = await db.select().from(contestRegistrations)
      .where(eq(contestRegistrations.contestId, contestId));
    expect((reg!.fields as Record<string, string>).country).toBe('ca'); // info edit persisted

    const accepts = await db.select().from(contestAgreementAcceptances)
      .where(eq(contestAgreementAcceptances.registrationId, reg!.id));
    expect(accepts).toHaveLength(1); // NOT 2 — dedup on (registration, field, terms-hash)
  });

  it('rejects a submission missing a required field (blocks registration)', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE);
    const res = await registerForContest(db, cfg, {
      contestId, userId, fields: { name: 'Ada', country: 'us', tos: 'true' }, // no email
    });
    expect(res.registered).toBe(false);
    expect(res.error).toMatch(/required/i);
    // Nothing written.
    expect(await getViewerRegistration(db, contestId, userId)).toBeNull();
  });

  it('empty template keeps legacy behaviour (closed 3-field shape, no partition)', async () => {
    const contestId = await makeContest(db, organizerId, []);
    const res = await registerForContest(db, cfg, {
      contestId, userId, fields: { building: 'a robot', experience: 'first', team: 'solo' },
    });
    expect(res.registered).toBe(true);
    const reg = await getViewerRegistration(db, contestId, userId);
    expect(reg?.fields).toEqual({ building: 'a robot', experience: 'first', team: 'solo' });
  });

  it('empty template still strips unknown keys and rejects a bad enum (legacy validation preserved)', async () => {
    const contestId = await makeContest(db, organizerId, []);
    // Unknown keys are stripped, not stored verbatim.
    const ok = await registerForContest(db, cfg, {
      contestId, userId, fields: { building: 'x', sneaky: 'y', k2: 'z' },
    });
    expect(ok.registered).toBe(true);
    expect(await getViewerRegistration(db, contestId, userId).then((r) => r?.fields)).toEqual({ building: 'x' });
    // A bad experience enum is rejected (not silently stored).
    const other = (await createTestUser(db, { username: `rr-bad-${crypto.randomUUID().slice(0, 6)}` })).id;
    const bad = await registerForContest(db, cfg, { contestId, userId: other, fields: { experience: 'guru' } });
    expect(bad.registered).toBe(false);
    expect(bad.error).toMatch(/invalid/i);
  });
});
