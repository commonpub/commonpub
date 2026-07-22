import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  contests,
  contestRegistrations,
  contestRegistrationPrivateFields,
  contestAgreementAcceptances,
  files,
  users,
} from '@commonpub/schema';
import type { FormField } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { registerForContest, getViewerRegistration, listContestRegistrants } from '../contest/registrations.js';
import { contestIdsForPrivateFile, sweepOrphanedContestFiles } from '../contest/submissions.js';
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

    // The PUBLIC column stores only public answers (name, country) — email is
    // default-PII, tos is consent, both partitioned OUT.
    const [rawReg] = await db.select({ fields: contestRegistrations.fields })
      .from(contestRegistrations).where(eq(contestRegistrations.userId, userId));
    expect(rawReg?.fields).toEqual({ name: 'Ada Lovelace', country: 'us' });

    // getViewerRegistration MERGES the viewer's own partitions for the edit form:
    // public + their PII + accepted agreements re-expressed as 'true'.
    const reg = await getViewerRegistration(db, contestId, userId);
    expect(reg?.fields).toEqual({ name: 'Ada Lovelace', country: 'us', email: 'ada@example.com', tos: 'true' });

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

  it('a bare FULL register (no fields) is REJECTED when the template has required fields', async () => {
    const contestId = await makeContest(db, organizerId, TEMPLATE); // TEMPLATE has required fields
    const other = (await createTestUser(db, { username: `rr-bare-${crypto.randomUUID().slice(0, 6)}` })).id;
    // No fields at all — the enforcement must not let this through as a full participant.
    const res = await registerForContest(db, cfg, { contestId, userId: other, tier: 'full' });
    expect(res.registered).toBe(false);
    expect(res.error).toMatch(/required/i);
    expect(await getViewerRegistration(db, contestId, other)).toBeNull();

    // But reminders-only (not a participant) is exempt from the required form.
    const rem = await registerForContest(db, cfg, { contestId, userId: other, tier: 'reminders' });
    expect(rem.registered).toBe(true);
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

  // P6: a `file` answer is stored as a bare files.id in the PRIVATE partition. The
  // /raw serving route + delete guard resolve which contest a file belongs to via
  // contestIdsForPrivateFile — the reverse lookup that scopes access to the
  // specific contest's organizers and blocks deletion of a submitted file.
  it('links a submitted file to its contest for per-contest access scoping', async () => {
    const fileUserId = (await createTestUser(db, { username: `rr-file-${crypto.randomUUID().slice(0, 6)}`, email: `f${crypto.randomUUID().slice(0, 6)}@ex.com` })).id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, fileUserId));
    // A private contest upload the user owns.
    const [file] = await db.insert(files).values({
      uploaderId: fileUserId, filename: 'contest/waiver.pdf', originalName: 'waiver.pdf',
      mimeType: 'application/pdf', sizeBytes: 2048, storageKey: 'contest/waiver.pdf',
      purpose: 'contest', visibility: 'private',
    }).returning({ id: files.id });
    const fileId = file!.id;

    const contestId = await makeContest(db, organizerId, [
      { key: 'waiver', label: 'Signed waiver', type: 'file', required: true },
    ]);
    const res = await registerForContest(db, cfg, { contestId, userId: fileUserId, fields: { waiver: fileId } });
    expect(res.registered).toBe(true);

    // The file resolves to exactly this contest…
    expect(await contestIdsForPrivateFile(db, fileId)).toEqual([contestId]);
    // …and the stored answer is in the PRIVATE partition, never the public jsonb.
    const [priv] = await db.select().from(contestRegistrationPrivateFields).where(eq(contestRegistrationPrivateFields.contestId, contestId));
    expect((priv?.fields as Record<string, string>)?.waiver).toBe(fileId);
    const [pub] = await db.select({ fields: contestRegistrations.fields }).from(contestRegistrations).where(eq(contestRegistrations.contestId, contestId));
    expect((pub?.fields as Record<string, string> | null)?.waiver).toBeUndefined();

    // An unreferenced file id resolves to no contest (owner-only access; deletable).
    expect(await contestIdsForPrivateFile(db, crypto.randomUUID())).toEqual([]);
  });

  // SECURITY REGRESSION (session-244 audit blocker): the reverse lookup must match
  // ONLY the file owner's own submission rows (user_id = uploader_id). Otherwise a
  // contest.pii holder could paste a VICTIM's file uuid into a pii-text/signature
  // field of a contest THEY organize (those field types skip validateFileFields) and
  // read the victim's private bytes via the self-owned contest.
  it('does NOT link a victim file uuid smuggled into another user\'s pii-text field', async () => {
    const victim = (await createTestUser(db, { username: `rr-vic-${crypto.randomUUID().slice(0, 6)}`, email: `v${crypto.randomUUID().slice(0, 6)}@ex.com` })).id;
    const attacker = (await createTestUser(db, { username: `rr-atk-${crypto.randomUUID().slice(0, 6)}`, email: `a${crypto.randomUUID().slice(0, 6)}@ex.com` })).id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, attacker));

    // Victim's private file — never submitted anywhere.
    const [vfile] = await db.insert(files).values({
      uploaderId: victim, filename: 'contest/secret.pdf', originalName: 'secret.pdf',
      mimeType: 'application/pdf', sizeBytes: 999, storageKey: 'contest/secret.pdf',
      purpose: 'contest', visibility: 'private',
    }).returning({ id: files.id });
    const victimFileId = vfile!.id;

    // Attacker organizes a contest with a pii:true TEXT field (skips validateFileFields)
    // and registers submitting the victim's file uuid as their own "answer".
    const attackContest = await makeContest(db, attacker, [
      { key: 'smuggle', label: 'Notes', type: 'text', required: false, pii: true },
    ]);
    const res = await registerForContest(db, cfg, { contestId: attackContest, userId: attacker, fields: { smuggle: victimFileId } });
    expect(res.registered).toBe(true);
    // The uuid IS stored (it's a valid string answer)…
    const [row] = await db.select().from(contestRegistrationPrivateFields).where(eq(contestRegistrationPrivateFields.contestId, attackContest));
    expect((row?.fields as Record<string, string>)?.smuggle).toBe(victimFileId);
    // …but the reverse lookup must NOT resolve the victim's file to the attacker's
    // contest (row user_id = attacker ≠ file uploader = victim), so the attacker is
    // never authorized as an "organizer of a contest the file was submitted to".
    expect(await contestIdsForPrivateFile(db, victimFileId)).toEqual([]);
  });

  // Session-244 post-roll: the orphaned-file sweep deletes ABANDONED private contest
  // uploads (old + not referenced by their owner's submission), bounding storage +
  // cleaning up bytes that lost their reference on unregister/withdraw.
  it('sweepOrphanedContestFiles: deletes old unreferenced private files, keeps referenced + recent + public', async () => {
    const owner = (await createTestUser(db, { username: `sw-${crypto.randomUUID().slice(0, 6)}`, email: `s${crypto.randomUUID().slice(0, 6)}@ex.com` })).id;
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, owner));
    const old = new Date(Date.now() - 72 * 3_600_000); // beyond a 48h grace
    const mk = async (over: Record<string, unknown>): Promise<string> => {
      const [f] = await db.insert(files).values({
        uploaderId: owner, filename: 'contest/x.pdf', originalName: 'x.pdf', mimeType: 'application/pdf',
        sizeBytes: 10, storageKey: `contest/${crypto.randomUUID()}.pdf`, purpose: 'contest', visibility: 'private',
        ...over,
      }).returning({ id: files.id });
      return f!.id;
    };
    const abandonedOld = await mk({ createdAt: old });
    const recent = await mk({ createdAt: new Date() });         // within grace → keep
    const publicOld = await mk({ createdAt: old, visibility: 'public', purpose: 'content' }); // not private/contest → keep

    // A referenced file: registered with it under a file field (old, but referenced → keep).
    const referenced = await mk({ createdAt: old });
    const contestId = await makeContest(db, organizerId, [{ key: 'doc', label: 'Doc', type: 'file', required: false }]);
    await registerForContest(db, cfg, { contestId, userId: owner, fields: { doc: referenced } });

    const sweptKeys: string[] = [];
    const res = await sweepOrphanedContestFiles(db, async (k) => { sweptKeys.push(k); }, { olderThanMs: 48 * 3_600_000, limit: 100 });

    expect(res.swept).toBe(1); // only abandonedOld
    expect(sweptKeys).toHaveLength(1);
    const remaining = new Set((await db.select({ id: files.id }).from(files)).map((r) => r.id));
    expect(remaining.has(abandonedOld)).toBe(false); // deleted (row + bytes)
    expect(remaining.has(recent)).toBe(true);
    expect(remaining.has(publicOld)).toBe(true);
    expect(remaining.has(referenced)).toBe(true);   // owner submitted it → not orphaned
  });
});
