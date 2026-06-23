import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContest, transitionContestStatus } from '../contest/contest.js';
import { submitContestProposal } from '../contest/submissions.js';
import { buildContestExport, toCsv } from '../contest/export.js';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';

describe('toCsv (RFC 4180)', () => {
  it('quotes fields with commas, quotes, and newlines; CRLF rows', () => {
    const csv = toCsv([
      ['a', 'b,c', 'd"e', 'f\ng'],
      ['1', '2', '3', '4'],
    ]);
    expect(csv).toBe('a,"b,c","d""e","f\ng"\r\n1,2,3,4');
  });

  it('neutralizes formula-injection leading chars (= + - @ TAB CR)', () => {
    // Each dangerous leading char gets a `'` prefix so Excel/Sheets does not
    // evaluate it; a plain value is untouched.
    const csv = toCsv([['=SUM(A1)', '+1', '-2', '@x', 'plain', '85']]);
    expect(csv).toBe(`'=SUM(A1),'+1,'-2,'@x,plain,85`);
    // A formula that ALSO needs quoting (contains a comma) is prefixed then quoted.
    expect(toCsv([['=cmd|x,y']])).toBe(`"'=cmd|x,y"`);
  });
});

describe('buildContestExport', () => {
  let db: DB;
  let organizerId: string;

  const FORM: ContestSubmissionTemplateField[] = [
    { key: 'title', label: 'Project title', type: 'text', required: true },
    { key: 'summary', label: 'Summary', type: 'textarea', required: true },
    { key: 'email', label: 'Contact email', type: 'email', required: true, pii: true },
    { key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true, terms: 'Ship it.' },
  ];

  beforeAll(async () => {
    db = await createTestDB();
    organizerId = (await createTestUser(db, { username: 'exp-org' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  async function seedContestWithEntry() {
    const contest = await createContest(db, {
      title: 'Export Contest',
      slug: `export-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-08-01').toISOString(),
      createdBy: organizerId,
      judgingCriteria: [
        { label: 'Feasibility', weight: 40 },
        { label: 'Impact', weight: 60 },
      ],
      stages: [
        { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionMode: 'proposal' as const, submissionTemplate: FORM },
        { id: 'rev', name: 'Judging', kind: 'review' as const },
      ],
      currentStageId: 'prop',
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `exp-entrant-${Date.now()}` });
    await submitContestProposal(db, {
      contestId: contest.id,
      stageId: 'prop',
      fields: { title: 'Solar Pump', summary: 'A plan, with a comma', email: 'me@example.com', tos: 'true' },
      userId: entrant.id,
    });
    return contest;
  }

  it('emits a header with rubric columns, omits PII when not permitted, includes it when permitted', async () => {
    const contest = await seedContestWithEntry();

    const noPii = (await buildContestExport(db, contest.id, false))!;
    const headerNoPii = noPii.csv.split('\r\n')[0]!;
    // Rubric criteria become empty tally columns.
    expect(headerNoPii).toContain('Feasibility');
    expect(headerNoPii).toContain('Impact');
    // No PII column, and the email value never appears anywhere.
    expect(headerNoPii).not.toContain('PII: email');
    expect(noPii.csv).not.toContain('me@example.com');
    // The non-PII artifact summary IS present (and the comma is quoted).
    expect(noPii.csv).toContain('Solar Pump');
    expect(noPii.filename).toBe(`${contest.slug}-entries.csv`);

    const withPii = (await buildContestExport(db, contest.id, true))!;
    expect(withPii.csv.split('\r\n')[0]).toContain('PII: email');
    expect(withPii.csv).toContain('me@example.com');
  });

  it('neutralizes a formula-injection title end to end', async () => {
    const contest = await createContest(db, {
      title: 'Inject Contest',
      slug: `inject-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-08-01').toISOString(),
      createdBy: organizerId,
      stages: [
        { id: 'prop', name: 'Proposals', kind: 'submission' as const, submissionMode: 'proposal' as const,
          submissionTemplate: [{ key: 'title', label: 'Title', type: 'text', required: true }, ...FORM.slice(1)] },
      ],
      currentStageId: 'prop',
    });
    await transitionContestStatus(db, contest.id, organizerId, 'active');
    const entrant = await createTestUser(db, { username: `inject-ent-${Date.now()}` });
    await submitContestProposal(db, {
      contestId: contest.id,
      stageId: 'prop',
      fields: { title: '=HYPERLINK("http://evil","x")', summary: 'ok', email: 'me@example.com', tos: 'true' },
      userId: entrant.id,
    });
    const { csv } = (await buildContestExport(db, contest.id, false))!;
    expect(csv).not.toMatch(/(^|,|")=HYPERLINK/m); // never a bare formula at a cell start
    expect(csv).toContain(`'=HYPERLINK`); // neutralized
  });

  it('returns null for a missing contest', async () => {
    expect(await buildContestExport(db, '00000000-0000-4000-8000-000000000000', true)).toBeNull();
  });
});
