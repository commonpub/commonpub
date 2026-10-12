/**
 * Contest personal-data routes, run for real (session 261 test audit).
 *
 * Until this file, the routes that hand out registrant and entrant personal data
 * were covered only by tests that READ THEIR SOURCE for a permission name, which
 * pass as long as the word is present, whatever the code does with it. These run
 * the shipped handlers against a real (PGlite) database with the real
 * `requireAuth`, `getOptionalUser`, `hasPermission` and `ownerOrPermission`, so a
 * refusal here is the refusal a browser would get.
 *
 * The rule under test, per route:
 *   registrants / registrants-export   owner, contest.manage (admin) or per-contest
 *                                      editor; personal columns need contest.pii too;
 *                                      the shipping list is refused without it.
 *   export (entries CSV)               the same organizers, plus ACCEPTED judges;
 *                                      personal columns need contest.pii.
 *   entries/:id/private                the entrant, or contest.pii AND an organizer
 *                                      or accepted-judge role on THIS contest.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { contests } from '@commonpub/schema';
import type { FormField, ContestSubmissionTemplateField } from '@commonpub/schema';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../packages/server/src/types';
import { registerForContest } from '../../../../../../packages/server/src/contest/registrations';
import { addContestJudge, acceptJudgeInvite } from '../../../../../../packages/server/src/contest/judges';
import { addContestStakeholder } from '../../../../../../packages/server/src/contest/stakeholders';
import { submitContestProposal } from '../../../../../../packages/server/src/contest/submissions';
import { harness, installNitroStubs, makeEvent, expectStatus } from '../../../../test-helpers/nitroStubs';

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;
interface Who { id: string; role: string; perms?: string[] }

const ADDRESS = JSON.stringify({ line1: '1039 South Fair Play Way', city: 'Aurora', region: 'CO', postal: '80012', country: 'USA' });
const REG: FormField[] = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'ship', label: 'Shipping address', type: 'address', required: true },
];
const PROPOSAL: ContestSubmissionTemplateField[] = [
  { key: 'pitch', label: 'Pitch', type: 'text', required: true },
  { key: 'mail', label: 'Mailing address', type: 'address', required: true },
];

let db: DB;
let slug: string;
let otherSlug: string;
let entryId: string;
const u: Record<'owner' | 'admin' | 'editor' | 'entrant' | 'judge' | 'pending' | 'outsider' | 'piiStaff' | 'otherOwner', Who> = {} as never;
let registrants: Handler;
let registrantsExport: Handler;
let entriesExport: Handler;
let privateGet: Handler;

/** An event carrying `who` exactly the way the auth + permissions middleware attach it. */
function as(who: Who | null, init: { slug?: string; query?: Record<string, string>; params?: Record<string, string> } = {}) {
  return makeEvent({
    params: { slug: init.slug ?? slug, ...(init.params ?? {}) },
    query: init.query ?? {},
    context: who
      ? { auth: { user: { id: who.id, role: who.role } }, cpubPermissions: { permissions: new Set(who.perms ?? []), primaryRole: who.role } }
      : {},
  });
}

beforeAll(async () => {
  await installNitroStubs();
  // The real auth and permission helpers replace the harness's simplified ones.
  const g = globalThis as unknown as Record<string, unknown>;
  const auth = await import('../../../utils/auth');
  const perms = await import('../../../utils/requirePermission');
  g.requireAuth = auth.requireAuth;
  g.getOptionalUser = auth.getOptionalUser;
  g.hasPermission = perms.hasPermission;
  g.ownerOrPermission = perms.ownerOrPermission;
  g.requirePermission = perms.requirePermission;
  g.setHeader = (e: { headersOut?: Record<string, string> }, k: string, v: string): void => { (e.headersOut ??= {})[k] = v; };
  g.useRuntimeConfig = () => ({ public: { siteUrl: 'https://test.example' } });
  harness.features = { ...harness.features, contests: true, contestPii: true, contestStageSubmissions: true, contestProposals: true };
  harness.config = { instance: { domain: 'test.example', name: 'Test' } };

  db = await createTestDB();
  harness.db = db;
  const mk = async (name: string, role = 'member', perms: string[] = []): Promise<Who> =>
    ({ id: (await createTestUser(db, { username: `${name}-${Date.now()}`, role })).id, role, perms });
  u.owner = await mk('owner');
  u.admin = await mk('admin', 'admin');
  u.editor = await mk('editor');
  u.entrant = await mk('entrant');
  u.judge = await mk('judge');
  u.pending = await mk('pending');
  u.outsider = await mk('outsider');
  // A staff account granted contest.pii instance-wide, with no role on this contest.
  u.piiStaff = await mk('staff', 'staff', ['contest.pii']);
  u.otherOwner = await mk('other');

  const insert = async (owner: Who, s: string): Promise<string> => {
    const [row] = await db.insert(contests).values({
      title: `PII ${s}`, slug: s, status: 'active', createdById: owner.id,
      startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'),
      registrationTemplate: REG,
      stages: [
        { id: 'p', name: 'Proposals', kind: 'submission', submissionMode: 'proposal', submissionTemplate: PROPOSAL },
        { id: 'r', name: 'Review', kind: 'review' },
      ],
      currentStageId: 'p',
    }).returning({ id: contests.id });
    return row!.id;
  };
  slug = `pii-${crypto.randomUUID().slice(0, 8)}`;
  otherSlug = `pii-other-${crypto.randomUUID().slice(0, 8)}`;
  const contestId = await insert(u.owner, slug);
  await insert(u.otherOwner, otherSlug);

  const cfg = { features: harness.features, instance: harness.config.instance } as never;
  const reg = await registerForContest(db, cfg, { contestId, userId: u.entrant.id, fields: { name: 'Jasiah Jones', email: 'jasiah@example.com', ship: ADDRESS } });
  expect(reg.registered).toBe(true);
  const sub = await submitContestProposal(db, { contestId, stageId: 'p', fields: { pitch: 'A pump', mail: ADDRESS }, userId: u.entrant.id });
  expect(sub.ok).toBe(true);
  entryId = (sub as { entryId?: string }).entryId ?? '';
  if (!entryId) {
    const { contestEntries } = await import('@commonpub/schema');
    const { eq } = await import('drizzle-orm');
    entryId = (await db.select({ id: contestEntries.id }).from(contestEntries).where(eq(contestEntries.contestId, contestId)))[0]!.id;
  }

  expect((await addContestStakeholder(db, contestId, u.editor.id, { role: 'editor' })).added).toBe(true);
  expect((await addContestJudge(db, contestId, u.judge.id, 'judge')).added).toBe(true);
  expect(await acceptJudgeInvite(db, contestId, u.judge.id)).toBe(true);
  expect((await addContestJudge(db, contestId, u.pending.id, 'judge')).added).toBe(true);

  registrants = (await import('../[slug]/registrants.get')).default as unknown as Handler;
  registrantsExport = (await import('../[slug]/registrants-export.get')).default as unknown as Handler;
  entriesExport = (await import('../[slug]/export.get')).default as unknown as Handler;
  privateGet = (await import('../[slug]/entries/[entryId]/private.get')).default as unknown as Handler;
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
  vi.restoreAllMocks();
});

const status = async (h: Handler, e: ReturnType<typeof makeEvent>): Promise<number> => (await expectStatus(h, e))?.statusCode ?? 200;

describe('GET /api/contests/:slug/registrants', () => {
  it('refuses the anonymous, entrants, judges and outsiders', async () => {
    expect(await status(registrants, as(null))).toBe(401);
    for (const who of [u.entrant, u.judge, u.pending, u.outsider, u.piiStaff]) {
      expect(await status(registrants, as(who)), who.id).toBe(403);
    }
  });

  it('organizers see the list; personal answers only with contest.pii', async () => {
    const plain = (await registrants(as(u.owner))) as { items: Array<{ privateFields?: unknown }>; includePii: boolean };
    expect(plain.items).toHaveLength(1);
    expect(plain.includePii).toBe(false);
    expect(JSON.stringify(plain)).not.toContain('jasiah@example.com');

    const editor = (await registrants(as(u.editor))) as { includePii: boolean };
    expect(editor.includePii).toBe(false);

    const admin = (await registrants(as(u.admin))) as { includePii: boolean };
    expect(admin.includePii).toBe(true);
    expect(JSON.stringify(admin)).toContain('jasiah@example.com');

    const ownerWithPii = (await registrants(as({ ...u.owner, perms: ['contest.pii'] }))) as { includePii: boolean };
    expect(ownerWithPii.includePii).toBe(true);
  });
});

describe('GET /api/contests/:slug/registrants-export', () => {
  it('refuses everyone but organizers', async () => {
    expect(await status(registrantsExport, as(null))).toBe(401);
    for (const who of [u.entrant, u.judge, u.outsider, u.piiStaff]) {
      expect(await status(registrantsExport, as(who)), who.id).toBe(403);
    }
  });

  it('an organizer without contest.pii gets a sheet with no personal values, and no shipping list', async () => {
    const csv = (await registrantsExport(as(u.owner))) as string;
    expect(csv).toContain('Jasiah Jones'); // the public answer
    expect(csv).not.toContain('jasiah@example.com');
    expect(csv).not.toContain('Fair Play');
    const refused = await expectStatus(registrantsExport, as(u.owner, { query: { format: 'shipping' } }));
    expect(refused?.statusCode).toBe(403);
    expect(refused?.statusMessage).toContain('personal data');
  });

  it('a contest.pii holder gets the shipping list with the address split', async () => {
    const csv = (await registrantsExport(as(u.admin, { query: { format: 'shipping' } }))) as string;
    expect(csv).toContain('Shipping address: City');
    expect(csv).toContain('Aurora');
    expect(csv).toContain('jasiah@example.com');
    expect(csv).not.toContain('{"line1"');
  });

  it('rejects an unknown format instead of guessing', async () => {
    expect(await status(registrantsExport, as(u.admin, { query: { format: 'everything' } }))).toBe(400);
  });
});

describe('GET /api/contests/:slug/export (entries)', () => {
  it('admits organizers and accepted judges only', async () => {
    expect(await status(entriesExport, as(null))).toBe(401);
    for (const who of [u.entrant, u.pending, u.outsider, u.piiStaff]) {
      expect(await status(entriesExport, as(who)), who.id).toBe(403);
    }
    for (const who of [u.owner, u.editor, u.admin, u.judge]) {
      expect(await status(entriesExport, as(who)), who.id).toBe(200);
    }
  });

  it('carries personal columns only for contest.pii holders', async () => {
    const judgeCsv = (await entriesExport(as(u.judge))) as string;
    expect(judgeCsv).not.toContain('Fair Play');
    const adminCsv = (await entriesExport(as(u.admin))) as string;
    expect(adminCsv).toContain('Mailing address: Address line 1');
    expect(adminCsv).toContain('1039 South Fair Play Way');
  });
});

describe('GET /api/contests/:slug/entries/:entryId/private', () => {
  const ev = (who: Who | null, s = slug) => as(who, { slug: s, params: { entryId } });

  it('the entrant reads their own', async () => {
    const data = (await privateGet(ev(u.entrant))) as { fields: Record<string, string> };
    expect(data.fields.mail).toBe(ADDRESS);
  });

  it('contest.pii alone is not enough: it needs a role on THIS contest', async () => {
    expect(await status(privateGet, ev(u.piiStaff))).toBe(403);
    // The owner and the accepted judge have the role but not the permission.
    expect(await status(privateGet, ev(u.owner))).toBe(403);
    expect(await status(privateGet, ev(u.judge))).toBe(403);
    // Both together: allowed.
    expect(await status(privateGet, ev({ ...u.judge, perms: ['contest.pii'] }))).toBe(200);
    expect(await status(privateGet, ev({ ...u.owner, perms: ['contest.pii'] }))).toBe(200);
    expect(await status(privateGet, ev(u.admin))).toBe(200);
  });

  it('a pending judge with contest.pii is still refused', async () => {
    expect(await status(privateGet, ev({ ...u.pending, perms: ['contest.pii'] }))).toBe(403);
  });

  it('an entry is not reachable through another contest\'s slug', async () => {
    expect(await status(privateGet, ev({ ...u.otherOwner, perms: ['contest.pii'] }, otherSlug))).toBe(404);
  });

  it('never caches', async () => {
    const e = ev(u.entrant);
    await privateGet(e);
    expect((e as unknown as { headersOut: Record<string, string> }).headersOut['Cache-Control']).toBe('no-store');
  });
});
