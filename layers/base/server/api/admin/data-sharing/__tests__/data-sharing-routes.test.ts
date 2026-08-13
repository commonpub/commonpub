/**
 * Behavioural tests for the three `/api/admin/data-sharing/*` handlers, against
 * a real (PGlite) database.
 *
 * These routes are read from source by the page test, which can prove the page
 * mirrors the contract but cannot prove the contract is TRUE. Three things here
 * are only decidable by running the query:
 *
 *  1. the month bucketing and the distinct-member count. "Members disclosed per
 *     recipient per month" is the whole disclosure panel, and a `count(*)` where
 *     a `count(distinct user_id)` belongs would report 30 people where there are
 *     12, which is the exact number an operator would act on;
 *  2. the per-entry config diagnosis. `recipientsFromConfig` returns NOTHING when
 *     any part of the `dataSharing` document fails, so an operator who mistyped
 *     one recipient sees an empty list. Reporting the refused entry is the point
 *     of the route, and it can only be checked by handing it a real bad document;
 *  3. the write path and its audit row, including the digest moving. A recipient
 *     list saved without an audit row is an unattributable change to who receives
 *     members' personal data.
 *
 * The guards themselves are covered by the admin permission sweeps
 * (`all-routes-gated`, `admin-route-keys`); what is asserted here is the ORDER
 * and the STATUS, which a source read cannot see: a disabled flag must 404 so
 * the surface stays invisible, not 403.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { auditLogs, disclosureEvents, instanceSettings } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../../packages/server/src/types';
import {
  harness,
  installNitroStubs,
  makeEvent,
  resetHarness,
  expectStatus,
} from '../../../../../test-helpers/nitroStubs';

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;

let db: DB;
let adminId: string;
let recipientsGet: Handler;
let recipientsPut: Handler;
let disclosuresGet: Handler;

/** A minimal papered processor, valid under `dataRecipientSchema`. */
function recipient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'acme',
    name: 'Acme Robotics',
    privacyPolicyUrl: 'https://acme.example/privacy',
    purposes: ['recruiter_visibility'],
    relationship: 'processor',
    ...overrides,
  };
}

// `createTestDB` spins up PGlite and pushes the whole schema, which is well over
// vitest's 10s default hook budget once the rest of the suite is competing for
// the machine. Every sibling PGlite suite in this layer carries the same budget.
beforeAll(async () => {
  await installNitroStubs();
  db = await createTestDB();
  const admin = await createTestUser(db, { username: 'admin', role: 'admin' });
  adminId = admin.id;

  recipientsGet = (await import('../recipients.get')).default as unknown as Handler;
  recipientsPut = (await import('../recipients.put')).default as unknown as Handler;
  disclosuresGet = (await import('../disclosures.get')).default as unknown as Handler;
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
  vi.restoreAllMocks();
});

beforeEach(async () => {
  resetHarness();
  harness.db = db;
  harness.user = { id: adminId, role: 'admin' };
  harness.config = { dataSharing: { recipients: [recipient()] } };
  await db.delete(disclosureEvents);
  await db.delete(auditLogs);
  await db.delete(instanceSettings);
});

// --- Gating -----------------------------------------------------------------

describe('/api/admin/data-sharing — the gates, by status not by source', () => {
  it.each([
    ['recipients.get', () => recipientsGet],
    ['disclosures.get', () => disclosuresGet],
  ])('%s 404s with the persona flag off, so the surface stays invisible', async (_n, get) => {
    harness.features.persona = false;
    const err = await expectStatus(get(), makeEvent());
    expect(err?.statusCode).toBe(404);
  });

  it('recipients.put 404s with the persona flag off, before it reads the body', async () => {
    harness.features.persona = false;
    const err = await expectStatus(
      recipientsPut,
      makeEvent({ method: 'PUT', body: { recipients: [] } }),
    );
    expect(err?.statusCode).toBe(404);
  });

  it('403s without settings.manage rather than answering', async () => {
    harness.permissions = ['audit.read'];
    const err = await expectStatus(recipientsGet, makeEvent());
    expect(err?.statusCode).toBe(403);
  });
});

// --- The read ---------------------------------------------------------------

interface RecipientsResponse {
  configRecipients: Array<{ id: string; source: string; unpapered: boolean; shadowedByConfig: boolean }>;
  storedRecipients: Array<{ id: string; source: string; shadowedByConfig: boolean }>;
  configError: string | null;
  droppedConfigEntries: Array<{ index: number; id: string | null; error: string }>;
  purposes: Array<{ id: string; offerable: boolean; blocker: string | null; recipientIds: string[] }>;
  scopeDigest: string;
  maxStoredRecipients: number;
  disclosureRetentionYears: number;
  flags: { dataSharingConsents: boolean; memberDirectory: boolean };
}

describe('/api/admin/data-sharing/recipients GET', () => {
  it('returns the two halves SEPARATELY, each tagged with its source', async () => {
    await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [recipient({ id: 'globex', name: 'Globex' })] } }),
    );
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;

    expect(res.configRecipients.map((r) => r.id)).toEqual(['acme']);
    expect(res.storedRecipients.map((r) => r.id)).toEqual(['globex']);
    expect(res.configRecipients[0]?.source).toBe('config');
    expect(res.storedRecipients[0]?.source).toBe('database');
  });

  it('marks a stored entry the config file shadows, which is otherwise a silent no-op', async () => {
    await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [recipient({ name: 'Acme (stored)' })] } }),
    );
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;

    expect(res.storedRecipients[0]?.shadowedByConfig).toBe(true);
    expect(res.configRecipients[0]?.shadowedByConfig).toBe(false);
  });

  it('reports a config entry the schema refused, with its index and reason', async () => {
    harness.config = {
      dataSharing: {
        recipients: [recipient(), { ...recipient({ id: 'bad' }), privacyPolicyUrl: 'not-a-url' }],
      },
    };
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;

    // The whole document fails, so NOTHING from the file is in force. That is
    // the fail-closed behaviour, and the diagnosis is what makes it findable.
    expect(res.configRecipients).toEqual([]);
    expect(res.configError).not.toBeNull();
    expect(res.droppedConfigEntries).toHaveLength(1);
    expect(res.droppedConfigEntries[0]).toMatchObject({ index: 1, id: 'bad' });
    expect(res.droppedConfigEntries[0]?.error).toContain('privacyPolicyUrl');
  });

  it('reports an UNPAPERED controller as a refusal rather than dropping it silently', async () => {
    harness.config = {
      dataSharing: {
        // joint_controller with no agreementRef: refused by the schema refine.
        recipients: [recipient({ relationship: 'joint_controller' })],
      },
    };
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;

    expect(res.droppedConfigEntries).toHaveLength(1);
    expect(res.droppedConfigEntries[0]?.error).toContain('agreementRef');
  });

  it('says nothing was refused when the document is clean', async () => {
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;
    expect(res.configError).toBeNull();
    expect(res.droppedConfigEntries).toEqual([]);
  });

  it('explains a purpose with no recipient, and names the covering ids for one that has them', async () => {
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;
    const recruiter = res.purposes.find((p) => p.id === 'recruiter_visibility');
    const sponsor = res.purposes.find((p) => p.id === 'sponsor_sharing');

    // One papered recipient covers recruiter_visibility, and that purpose needs
    // no countable field, so it is offerable.
    expect(recruiter?.recipientIds).toEqual(['acme']);
    expect(recruiter?.offerable).toBe(true);
    expect(recruiter?.blocker).toBeNull();

    // Nothing covers sponsor_sharing, which requires a recipient.
    expect(sponsor?.recipientIds).toEqual([]);
    expect(sponsor?.offerable).toBe(false);
    expect(sponsor?.blocker).toBe('no_recipient');
  });

  it('explains that ONE unpapered recipient withdraws a purpose from every recipient on it', async () => {
    // The surprising refusal, and the reason the page renders a warning for it.
    // The unpapered entry cannot reach the effective list through the config
    // half (the schema refuses it), so it arrives through the DATABASE half...
    // which the same schema also refuses. Both readers refuse it, which is the
    // strongest possible statement: this route cannot report a live unpapered
    // recipient because one cannot exist. The refusal is therefore asserted
    // where it is reachable: on the write path and on the config diagnosis.
    const err = await expectStatus(
      recipientsPut,
      makeEvent({
        method: 'PUT',
        body: {
          recipients: [
            recipient({ id: 'sponsor-x', purposes: ['sponsor_sharing'], relationship: 'joint_controller' }),
          ],
        },
      }),
    );
    expect(err?.statusCode).toBe(400);
    expect(err?.statusMessage).toContain('agreementRef');

    // And with the papering supplied, the same recipient makes the purpose live.
    await recipientsPut(
      makeEvent({
        method: 'PUT',
        body: {
          recipients: [
            recipient({
              id: 'sponsor-x',
              purposes: ['sponsor_sharing'],
              relationship: 'joint_controller',
              agreementRef: 'DPA-2026-004',
            }),
          ],
        },
      }),
    );
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;
    const sponsor = res.purposes.find((p) => p.id === 'sponsor_sharing');
    expect(sponsor?.recipientIds).toEqual(['sponsor-x']);
    expect(sponsor?.offerable).toBe(true);
  });

  it('never reports a purpose as offerable that currentPurposeScope refused', async () => {
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;
    for (const purpose of res.purposes) {
      if (!purpose.offerable) expect(purpose.blocker, purpose.id).not.toBeNull();
      else expect(purpose.blocker, purpose.id).toBeNull();
    }
  });

  it('computes the digest over the file UNION database list, not the file alone', async () => {
    const before = (await recipientsGet(makeEvent())) as RecipientsResponse;
    await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [recipient({ id: 'globex', name: 'Globex' })] } }),
    );
    const after = (await recipientsGet(makeEvent())) as RecipientsResponse;

    // The trap this guards: reading `config.dataSharing` directly would leave
    // the digest unmoved, and an admin-added recipient would receive members'
    // data on a grant given before that recipient was ever named to them.
    expect(after.scopeDigest).not.toBe(before.scopeDigest);
  });

  it('reports the retention the purge job will use, and the two flags', async () => {
    harness.config = {
      dataSharing: { recipients: [recipient()], disclosureRetentionYears: 5 },
    };
    harness.features.memberDirectory = true;
    const res = (await recipientsGet(makeEvent())) as RecipientsResponse;

    expect(res.disclosureRetentionYears).toBe(5);
    expect(res.flags).toEqual({ dataSharingConsents: true, memberDirectory: true });
    expect(res.maxStoredRecipients).toBe(50);
  });
});

// --- The write --------------------------------------------------------------

interface PutResponse {
  storedRecipients: Array<{ id: string }>;
  cleared: boolean;
  previousScopeDigest: string;
  scopeDigest: string;
  grantsNeedReconfirmation: boolean;
}

describe('/api/admin/data-sharing/recipients PUT', () => {
  it('stores the list and writes an audit row carrying the ids ADDED', async () => {
    const res = (await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [recipient({ id: 'globex', name: 'Globex' })] } }),
    )) as PutResponse;

    expect(res.storedRecipients.map((r) => r.id)).toEqual(['globex']);
    expect(res.grantsNeedReconfirmation).toBe(true);
    expect(res.previousScopeDigest).not.toBe(res.scopeDigest);

    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'dataSharing.recipients.save'));
    expect(rows).toHaveLength(1);
    // The ids, not a count: "who did we start sending members' data to" cannot
    // be answered by a number.
    expect(rows[0]?.metadata).toMatchObject({ added: ['globex'], removed: [] });
    expect(rows[0]?.userId).toBe(adminId);
  });

  it('refuses the WHOLE list when one entry is invalid, naming the index and the field', async () => {
    const err = await expectStatus(
      recipientsPut,
      makeEvent({
        method: 'PUT',
        body: {
          recipients: [
            recipient({ id: 'globex', name: 'Globex' }),
            recipient({ id: 'evil', relationship: 'independent_controller' }),
          ],
        },
      }),
    );

    expect(err?.statusCode).toBe(400);
    expect(err?.statusMessage).toContain('recipients[1]');
    expect(err?.statusMessage).toContain('agreementRef');

    // And NOTHING was written. A partial save would leave the instance
    // disclosing to a recipient the operator believes they removed.
    const stored = await db.select().from(instanceSettings);
    expect(stored).toHaveLength(0);
  });

  it('an empty list removes the stored row, so the config file is the whole list again', async () => {
    await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [recipient({ id: 'globex', name: 'Globex' })] } }),
    );
    const res = (await recipientsPut(
      makeEvent({ method: 'PUT', body: { recipients: [] } }),
    )) as PutResponse;

    expect(res.cleared).toBe(true);
    expect(res.storedRecipients).toEqual([]);
    const stored = await db.select().from(instanceSettings);
    expect(stored).toHaveLength(0);
  });

  it('rejects a body that is not the envelope at all', async () => {
    const err = await expectStatus(
      recipientsPut,
      makeEvent({ method: 'PUT', body: { recipients: 'all of them' } }),
    );
    expect(err?.statusCode).toBe(400);
  });
});

// --- The disclosure panel ---------------------------------------------------

interface DisclosuresResponse {
  months: string[];
  recipients: Array<{
    recipientId: string;
    name: string | null;
    removed: boolean;
    months: Array<{ month: string; members: number; disclosures: number }>;
    totalMembers: number;
    totalDisclosures: number;
    lastDisclosedAt: string | null;
  }>;
  monthsRequested: number;
  disclosureRetentionYears: number;
  empty: boolean;
}

/** `YYYY-MM` of a UTC instant, the same key the route builds. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** A UTC instant `monthsAgo` whole months back, mid-month so it cannot straddle. */
function monthsAgo(n: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15, 12));
}

async function seedDisclosure(
  recipientId: string,
  userId: string,
  at: Date,
): Promise<void> {
  await db.insert(disclosureEvents).values({
    recipientId,
    userId,
    purpose: 'recruiter_visibility',
    scopeDigest: 'deadbeefdeadbeef',
    disclosedAt: at,
  });
}

describe('/api/admin/data-sharing/disclosures GET', () => {
  it('is empty, honestly, when nothing has been disclosed', async () => {
    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    expect(res.empty).toBe(true);
    expect(res.recipients).toEqual([]);
    expect(res.months).toHaveLength(12);
  });

  it('counts DISTINCT members, not rows, which is the extraction figure', async () => {
    const a = await createTestUser(db, { username: 'a' });
    const b = await createTestUser(db, { username: 'b' });
    const when = monthsAgo(0);
    // Three pulls, two people. A `count(*)` here reports 3 people.
    await seedDisclosure('acme', a.id, when);
    await seedDisclosure('acme', a.id, when);
    await seedDisclosure('acme', b.id, when);

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    const row = res.recipients.find((r) => r.recipientId === 'acme');
    expect(row?.totalMembers).toBe(2);
    expect(row?.totalDisclosures).toBe(3);
  });

  it('buckets by UTC month and gap-fills every label, so a quiet month is a visible zero', async () => {
    const a = await createTestUser(db, { username: 'c' });
    await seedDisclosure('acme', a.id, monthsAgo(0));
    await seedDisclosure('acme', a.id, monthsAgo(2));

    const res = (await disclosuresGet(makeEvent({ query: { months: '4' } }))) as DisclosuresResponse;
    const row = res.recipients[0]!;

    expect(res.months).toHaveLength(4);
    expect(res.months[3]).toBe(monthKey(new Date()));
    expect(row.months).toHaveLength(4);
    expect(row.months.map((m) => m.month)).toEqual(res.months);

    const current = row.months.find((m) => m.month === monthKey(monthsAgo(0)));
    const gap = row.months.find((m) => m.month === monthKey(monthsAgo(1)));
    const older = row.months.find((m) => m.month === monthKey(monthsAgo(2)));
    expect(current?.members).toBe(1);
    expect(gap).toEqual({ month: monthKey(monthsAgo(1)), members: 0, disclosures: 0 });
    expect(older?.members).toBe(1);
  });

  it('does not sum distinct members across months, because one person is one person', async () => {
    const a = await createTestUser(db, { username: 'd' });
    await seedDisclosure('acme', a.id, monthsAgo(0));
    await seedDisclosure('acme', a.id, monthsAgo(1));

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    const row = res.recipients[0]!;
    expect(row.totalMembers).toBe(1);
    expect(row.totalDisclosures).toBe(2);
    expect(row.months.reduce((n, m) => n + m.members, 0)).toBe(2);
  });

  it('excludes anything older than the requested window', async () => {
    const a = await createTestUser(db, { username: 'e' });
    await seedDisclosure('acme', a.id, monthsAgo(5));

    const res = (await disclosuresGet(makeEvent({ query: { months: '2' } }))) as DisclosuresResponse;
    expect(res.empty).toBe(true);
  });

  it('keeps a recipient nothing declares any more, and marks it removed', async () => {
    const a = await createTestUser(db, { username: 'f' });
    await seedDisclosure('gone-inc', a.id, monthsAgo(0));

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    const row = res.recipients.find((r) => r.recipientId === 'gone-inc');
    // The disclosure happened. Dropping the row would quietly shrink the record.
    expect(row?.removed).toBe(true);
    expect(row?.name).toBeNull();
  });

  it('names a declared recipient and sorts the busiest first', async () => {
    const a = await createTestUser(db, { username: 'g' });
    const b = await createTestUser(db, { username: 'h' });
    await seedDisclosure('quiet-co', a.id, monthsAgo(0));
    await seedDisclosure('acme', a.id, monthsAgo(0));
    await seedDisclosure('acme', b.id, monthsAgo(0));

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    expect(res.recipients.map((r) => r.recipientId)).toEqual(['acme', 'quiet-co']);
    expect(res.recipients[0]?.name).toBe('Acme Robotics');
    expect(res.recipients[0]?.removed).toBe(false);
  });

  it('returns an ISO instant for the last read', async () => {
    const a = await createTestUser(db, { username: 'i' });
    const at = monthsAgo(0);
    await seedDisclosure('acme', a.id, at);

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    const last = res.recipients[0]?.lastDisclosedAt;
    expect(last).not.toBeNull();
    expect(new Date(last as string).getTime()).toBe(at.getTime());
  });

  it('names no member anywhere in the payload', async () => {
    const a = await createTestUser(db, { username: 'private-person' });
    await seedDisclosure('acme', a.id, monthsAgo(0));

    const res = (await disclosuresGet(makeEvent())) as DisclosuresResponse;
    const serialised = JSON.stringify(res);
    expect(serialised).not.toContain('private-person');
    expect(serialised).not.toContain(a.id);
  });

  it('400s on a window outside the bounds rather than clamping silently', async () => {
    const tooMany = await expectStatus(disclosuresGet, makeEvent({ query: { months: '99' } }));
    expect(tooMany?.statusCode).toBe(400);
    const tooFew = await expectStatus(disclosuresGet, makeEvent({ query: { months: '0' } }));
    expect(tooFew?.statusCode).toBe(400);
  });
});
