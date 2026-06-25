import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContest,
  transitionContestStatus,
  listContestEntries,
  getContestEntry,
  submitContestEntry,
  withdrawContestEntry,
  submitStageArtifact,
  validateSubmissionFields,
  hashTerms,
} from '../contest/index.js';
import { submitContestProposal, getEntryPrivateData } from '../contest/submissions.js';
import { createContent, publishContent } from '../content/content.js';
import {
  contests,
  contestEntries,
  contestEntryPrivateFields,
  contentItems,
} from '@commonpub/schema';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

// A proposal form exercising every Phase 4 axis: scalar types, a select with
// options, a PII field, an address (auto-PII), and a must-accept agreement.
const PROPOSAL_FORM: ContestSubmissionTemplateField[] = [
  { key: 'title', label: 'Project title', type: 'text', required: true },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true },
  { key: 'team_size', label: 'Team size', type: 'number', required: false },
  { key: 'track', label: 'Track', type: 'select', required: true, options: [
    { value: 'sw', label: 'Software' }, { value: 'hw', label: 'Hardware' },
  ] },
  { key: 'email', label: 'Contact email', type: 'email', required: true, pii: true },
  { key: 'address', label: 'Mailing address', type: 'address', required: false },
  { key: 'tos', label: 'Rules agreement', type: 'agreement', required: true, mustAccept: true,
    terms: 'You agree to ship the hardware to winners.' },
];

describe('validateSubmissionFields (pure partition)', () => {
  it('splits artifact / PII / agreements and rejects bad values', () => {
    const r = validateSubmissionFields(PROPOSAL_FORM, {
      title: 'Solar Pump', summary: 'A water plan', team_size: '3',
      track: 'hw', email: 'a@b.com', tos: 'true',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // PII (email) + address-typed keys never reach the artifact.
    expect(r.result.artifact).toEqual({ title: 'Solar Pump', summary: 'A water plan', team_size: '3', track: 'hw' });
    expect(r.result.pii).toEqual({ email: 'a@b.com' });
    expect(r.result.agreements).toHaveLength(1);
    expect(r.result.agreements[0]!.fieldKey).toBe('tos');
  });

  it('requires acceptance of a must-accept agreement', () => {
    const r = validateSubmissionFields(PROPOSAL_FORM, {
      title: 'X', summary: 'Y', track: 'sw', email: 'a@b.com', tos: 'false',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/accept/i);
  });

  it('treats an email field as PII by DEFAULT (no pii flag), keeping it out of the artifact', () => {
    // Operator footgun fix: an `email` field without `pii:true` used to land the
    // entrant's email in the PUBLIC artifact. Email is now default-PII like address.
    const form: ContestSubmissionTemplateField[] = [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'contact', label: 'Contact email', type: 'email', required: true }, // NO pii flag
    ];
    const r = validateSubmissionFields(form, { title: 'X', contact: 'me@example.com' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.artifact).toEqual({ title: 'X' });
    expect(r.result.pii).toEqual({ contact: 'me@example.com' });
  });

  it('honors an explicit pii:false opt-out for a public contact email', () => {
    const form: ContestSubmissionTemplateField[] = [
      { key: 'contact', label: 'Public email', type: 'email', required: true, pii: false },
    ];
    const r = validateSubmissionFields(form, { contact: 'team@example.com' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.artifact).toEqual({ contact: 'team@example.com' });
    expect(r.result.pii).toEqual({});
  });

  it('rejects an invalid email, an out-of-set select, a bad number, and a malformed address', () => {
    const base = { title: 'X', summary: 'Y', track: 'hw', email: 'a@b.com', tos: 'true' };
    expect(validateSubmissionFields(PROPOSAL_FORM, { ...base, email: 'not-an-email' }).ok).toBe(false);
    expect(validateSubmissionFields(PROPOSAL_FORM, { ...base, track: 'nope' }).ok).toBe(false);
    expect(validateSubmissionFields(PROPOSAL_FORM, { ...base, team_size: 'lots' }).ok).toBe(false);
    expect(validateSubmissionFields(PROPOSAL_FORM, { ...base, address: 'not json' }).ok).toBe(false);
    // A well-formed address is accepted and routed to PII.
    const ok = validateSubmissionFields(PROPOSAL_FORM, { ...base, address: JSON.stringify({ line1: '1 Main', city: 'Town', country: 'US' }) });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(Object.keys(ok.result.pii).sort()).toEqual(['address', 'email']);
  });
});

describe('contest proposals (form-first)', () => {
  let db: DB;
  let organizerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'prop-organizer' })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  function proposalContestInput(slugHint: string, overrides?: { maxEntriesPerUser?: number }) {
    return {
      title: `Proposal ${slugHint}`,
      slug: `proposal-${slugHint}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-08-01').toISOString(),
      createdBy: organizerId,
      maxEntriesPerUser: overrides?.maxEntriesPerUser,
      stages: [
        { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionMode: 'proposal' as const, submissionTemplate: PROPOSAL_FORM },
        { id: 'prop2', name: 'Round 2 Proposals', kind: 'submission' as const, submissionMode: 'proposal' as const, submissionTemplate: PROPOSAL_FORM },
        { id: 'rev', name: 'Judging', kind: 'review' as const },
      ],
      currentStageId: 'prop',
    };
  }

  const goodForm = () => ({
    title: 'Solar Pump', summary: 'A water plan', team_size: '3',
    track: 'hw', email: 'entrant@example.com', tos: 'true',
    address: JSON.stringify({ line1: '1 Main St', city: 'Springfield', region: 'IL', postal: '62701', country: 'US' }),
  });

  it('creates a DRAFT placeholder project, links an entry, isolates PII, records the agreement', async () => {
    const contest = await createContest(db, proposalContestInput('happy'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-happy-${Date.now()}` });

    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id, ip: '203.0.113.7' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Placeholder project: created, DRAFT, owned by the entrant.
    const [content] = await db.select().from(contentItems).where(eq(contentItems.id, res.contentId));
    expect(content!.status).toBe('draft');
    expect(content!.authorId).toBe(entrant.id);
    expect(content!.slug).toBe(res.projectSlug);

    // Entry links the draft (published-only gate relaxed for proposal mode).
    const [entry] = await db.select().from(contestEntries).where(eq(contestEntries.id, res.entryId));
    expect(entry!.contentId).toBe(res.contentId);
    expect(entry!.userId).toBe(entrant.id);

    // Artifact carries ONLY the non-PII, non-agreement fields.
    expect(entry!.stageSubmissions).toHaveLength(1);
    expect(entry!.stageSubmissions[0]!.fields).toEqual({ title: 'Solar Pump', summary: 'A water plan', team_size: '3', track: 'hw' });
    expect(entry!.stageSubmissions[0]!.fields).not.toHaveProperty('email');
    expect(entry!.stageSubmissions[0]!.fields).not.toHaveProperty('address');
    expect(entry!.stageSubmissions[0]!.fields).not.toHaveProperty('tos');

    // PII lives in the private table, never the entry jsonb.
    const [priv] = await db.select().from(contestEntryPrivateFields).where(eq(contestEntryPrivateFields.entryId, res.entryId));
    expect(priv!.fields.email).toBe('entrant@example.com');
    expect(JSON.parse(priv!.fields.address!).city).toBe('Springfield');

    // Agreement acceptance: snapshot + matching hash + captured ip.
    const data = await getEntryPrivateData(db, res.entryId);
    expect(data!.agreements).toHaveLength(1);
    expect(data!.agreements[0]!.termsSnapshot).toBe('You agree to ship the hardware to winners.');
    expect(data!.agreements[0]!.termsHash).toBe(hashTerms('You agree to ship the hardware to winners.'));

    // entryCount bumped.
    const [c] = await db.select({ n: contests.entryCount }).from(contests).where(eq(contests.id, contest.id));
    expect(c!.n).toBe(1);

    // Returns the ACTUAL created type so the client routes to the right editor.
    expect(res.contentType).toBe('project');
  });

  it('returns the actual created type, not a guess from eligibleContentTypes', async () => {
    // Regression: the client must route by the RETURNED type, not eligibleTypes[0].
    // 'article' is a deprecated alias not in PLACEHOLDER_TYPES, so the placeholder
    // falls back to 'project'. The old client guess ('article') would 404; the
    // response must carry the real type ('project') so the redirect resolves.
    const input = { ...proposalContestInput('article-type'), eligibleContentTypes: ['article'] };
    const contest = await createContest(db, input);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-article-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.contentType).toBe('project'); // NOT 'article' (the eligibleTypes[0] guess)
    const [content] = await db.select().from(contentItems).where(eq(contentItems.id, res.contentId));
    expect(content!.type).toBe(res.contentType); // the URL the client builds must match this
  });

  it('the normal entries listing never leaks PII (privileged view shows artifact only)', async () => {
    const contest = await createContest(db, proposalContestInput('leak'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-leak-${Date.now()}` });
    await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });

    const priv = await listContestEntries(db, contest.id, { includeStageSubmissions: true });
    for (const item of priv.items) {
      for (const s of item.stageSubmissions ?? []) {
        expect(s.fields).not.toHaveProperty('email');
        expect(s.fields).not.toHaveProperty('address');
      }
    }
  });

  it('hides a draft proposal placeholder from the PUBLIC list but keeps it visible to the owner + privileged', async () => {
    const contest = await createContest(db, proposalContestInput('draft-vis'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-draftvis-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Public viewer (non-privileged, anonymous): the draft placeholder is hidden,
    // so its dead "View the project" link never surfaces.
    const pub = await listContestEntries(db, contest.id, { onlyPublishedContent: true });
    expect(pub.items).toHaveLength(0);
    expect(pub.total).toBe(0);

    // The entrant still sees their OWN draft entry (myEntries / submit-form gating).
    const mine = await listContestEntries(db, contest.id, { onlyPublishedContent: true, viewerId: entrant.id });
    expect(mine.items.map((e) => e.id)).toContain(res.entryId);
    expect(mine.total).toBe(1);

    // A different signed-in non-privileged viewer does NOT see it.
    const other = await createTestUser(db, { username: `prop-draftvis-other-${Date.now()}` });
    const otherView = await listContestEntries(db, contest.id, { onlyPublishedContent: true, viewerId: other.id });
    expect(otherView.items).toHaveLength(0);

    // Privileged callers (owner/admin/judge) omit the filter → still see the draft.
    const priv = await listContestEntries(db, contest.id);
    expect(priv.items.map((e) => e.id)).toContain(res.entryId);

    // Once the placeholder is developed + published, it appears publicly.
    await publishContent(db, res.contentId, entrant.id);
    const pubAfter = await listContestEntries(db, contest.id, { onlyPublishedContent: true });
    expect(pubAfter.items.map((e) => e.id)).toContain(res.entryId);
  });

  it('getContestEntry surfaces the backing contentStatus (the entry-detail route draft gate)', async () => {
    const contest = await createContest(db, proposalContestInput('detail-status'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-detailstatus-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // The proposal placeholder starts as a DRAFT — the route uses this to 404 the
    // detail for a non-owner/non-privileged viewer (the list already hides it).
    const draft = await getContestEntry(db, res.entryId);
    expect(draft!.contentStatus).toBe('draft');

    // Once published it flips, so the route stops gating + the client shows the link.
    await publishContent(db, res.contentId, entrant.id);
    const published = await getContestEntry(db, res.entryId);
    expect(published!.contentStatus).toBe('published');
  });

  it('rejects an unaccepted agreement and creates NO placeholder (validation precedes creation)', async () => {
    const contest = await createContest(db, proposalContestInput('noaccept'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-noaccept-${Date.now()}` });
    const before = await countUserContent(db, entrant.id);

    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: { ...goodForm(), tos: 'false' }, userId: entrant.id });
    expect(res.ok).toBe(false);
    expect(await countUserContent(db, entrant.id)).toBe(before); // no orphan draft
  });

  it('gates: non-proposal stage, non-current stage, and inactive contest are rejected', async () => {
    const contest = await createContest(db, proposalContestInput('gates'));
    const entrant = await createTestUser(db, { username: `prop-gates-${Date.now()}` });

    // Inactive (still 'upcoming').
    expect((await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id })).ok).toBe(false);

    await transitionContestStatus(db, contest.id, organizerId, 'active');
    // Review stage: not a submission stage.
    expect((await submitContestProposal(db, { contestId: contest.id, stageId: 'rev', fields: goodForm(), userId: entrant.id })).ok).toBe(false);
    // A proposal stage that is not the current one.
    const notCurrent = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop2', fields: goodForm(), userId: entrant.id });
    expect(notCurrent.ok).toBe(false);
    if (!notCurrent.ok) expect(notCurrent.error).toMatch(/not currently open/i);
  });

  it('an attach-mode stage refuses proposal submissions', async () => {
    const input = proposalContestInput('attachonly');
    input.stages[0] = { ...input.stages[0]!, submissionMode: 'attach' as never };
    const contest = await createContest(db, input);
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-attach-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not accepting proposals/i);
  });

  it('enforces the per-user entry cap without leaving a second draft', async () => {
    const contest = await createContest(db, proposalContestInput('cap', { maxEntriesPerUser: 1 }));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-cap-${Date.now()}` });

    expect((await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id })).ok).toBe(true);
    const afterFirst = await countUserContent(db, entrant.id);
    const second = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/limit/i);
    expect(await countUserContent(db, entrant.id)).toBe(afterFirst); // cap checked before createContent
  });

  it('withdraw archives a pristine proposal placeholder draft (no orphan stub)', async () => {
    const contest = await createContest(db, proposalContestInput('wd-draft'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-wd-draft-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const wd = await withdrawContestEntry(db, res.entryId, entrant.id);
    expect(wd.withdrawn).toBe(true);

    // Entry gone, entryCount decremented back to 0.
    const [entry] = await db.select().from(contestEntries).where(eq(contestEntries.id, res.entryId));
    expect(entry).toBeUndefined();
    const [c] = await db.select({ n: contests.entryCount }).from(contests).where(eq(contests.id, contest.id));
    expect(c!.n).toBe(0);

    // The abandoned draft placeholder is archived (not left as an orphan stub).
    const [content] = await db.select().from(contentItems).where(eq(contentItems.id, res.contentId));
    expect(content!.status).toBe('archived');
    expect(content!.deletedAt).not.toBeNull();
  });

  it('withdraw KEEPS a placeholder the entrant developed + published', async () => {
    const contest = await createContest(db, proposalContestInput('wd-pub'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-wd-pub-${Date.now()}` });
    const res = await submitContestProposal(db, { contestId: contest.id, stageId: 'prop', fields: goodForm(), userId: entrant.id });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // The entrant develops the placeholder into a real, published project.
    await publishContent(db, res.contentId, entrant.id);

    const wd = await withdrawContestEntry(db, res.entryId, entrant.id);
    expect(wd.withdrawn).toBe(true);

    // The real project survives the withdraw (status stays published, not archived).
    const [content] = await db.select().from(contentItems).where(eq(contentItems.id, res.contentId));
    expect(content!.status).toBe('published');
    expect(content!.deletedAt).toBeNull();
  });

  it('withdraw leaves an ATTACHED (non-placeholder) project untouched', async () => {
    const contest = await createContest(db, proposalContestInput('wd-attach'));
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `prop-wd-attach-${Date.now()}` });
    const project = await createContent(db, entrant.id, { type: 'project', title: 'My real project' });
    await publishContent(db, project.id, entrant.id);
    const entry = await submitContestEntry(db, contest.id, project.id, entrant.id);
    expect(entry).not.toBeNull();

    const wd = await withdrawContestEntry(db, entry!.id, entrant.id);
    expect(wd.withdrawn).toBe(true);

    // An attached project is the entrant's own work — never archived on withdraw.
    const [content] = await db.select().from(contentItems).where(eq(contentItems.id, project.id));
    expect(content!.status).toBe('published');
    expect(content!.deletedAt).toBeNull();
  });
});

describe('submitStageArtifact is PII-aware', () => {
  let db: DB;
  let organizerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'artifact-pii-org' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  it('partitions PII + agreement out of the public artifact on the attach path', async () => {
    const template: ContestSubmissionTemplateField[] = [
      { key: 'notes', label: 'Notes', type: 'textarea', required: true },
      { key: 'shipping_email', label: 'Shipping email', type: 'email', required: true, pii: true },
      { key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true, terms: 'Be excellent.' },
    ];
    const contest = await createContest(db, {
      title: 'Artifact PII', slug: `artifact-pii-${Date.now()}`,
      startDate: new Date('2026-04-01').toISOString(), endDate: new Date('2026-08-01').toISOString(),
      createdBy: organizerId,
      stages: [{ id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionTemplate: template }],
      currentStageId: 'prop',
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');

    const entrant = await createTestUser(db, { username: `artifact-pii-entrant-${Date.now()}` });
    const content = await createContent(db, entrant.id, { type: 'project', title: 'Attach project' });
    await publishContent(db, content.id, entrant.id);
    const entry = await submitContestEntry(db, contest.id, content.id, entrant.id);

    const res = await submitStageArtifact(db, entry!.id, 'prop',
      { notes: 'my notes', shipping_email: 'ship@example.com', tos: 'true' }, entrant.id, '198.51.100.4');
    expect(res.submitted).toBe(true);
    expect(res.stageSubmissions![0]!.fields).toEqual({ notes: 'my notes' });

    const [priv] = await db.select().from(contestEntryPrivateFields).where(eq(contestEntryPrivateFields.entryId, entry!.id));
    expect(priv!.fields.shipping_email).toBe('ship@example.com');

    const data = await getEntryPrivateData(db, entry!.id);
    expect(data!.agreements[0]!.fieldKey).toBe('tos');
    expect(data!.agreements[0]!.termsHash).toBe(hashTerms('Be excellent.'));
  });
});

async function countUserContent(db: DB, userId: string): Promise<number> {
  const rows = await db.select({ id: contentItems.id }).from(contentItems).where(eq(contentItems.authorId, userId));
  return rows.length;
}
