/**
 * Static contract test for the PUBLIC GET /api/contests/:slug/entries handler.
 *
 * Locks the session-171 privacy invariants: the endpoint MUST NOT leak
 * per-judge scores / written feedback to non-privileged callers, and aggregate
 * score exposure MUST honour the contest's judgingVisibility setting. Mirrors
 * the by-route draft-leak guard pattern — a source-string read, because a full
 * PGlite + nitro + better-auth harness for this handler isn't wired yet.
 *
 * The behavioural matrix for the decision itself lives in the exhaustive
 * `shouldRevealScores` unit test (packages/server contest.integration.test.ts).
 * This test guards that the endpoint actually wires that decision in.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const handlerPath = resolve(__dirname, '..', '[slug]', 'entries.get.ts');
const src = readFileSync(handlerPath, 'utf8');

describe('GET /api/contests/:slug/entries — judge-score leak guard', () => {
  it('reads the requesting user via getOptionalUser (non-throwing)', () => {
    expect(src, 'must call getOptionalUser(event)').toMatch(/getOptionalUser\(\s*event\s*\)/);
  });

  it('derives privilege from owner / contest.manage permission / panel judge', () => {
    expect(src, 'must check contest owner').toMatch(/createdById/);
    // Phase-1 RBAC: the former `user.role === 'admin'` privilege check is now
    // `hasPermission(event, 'contest.manage')` (admins still pass via the
    // gate's admin floor flag-off; a contest.manage grant also passes flag-on).
    expect(src, 'must check contest.manage permission').toMatch(
      /hasPermission\(\s*event\s*,\s*['"]contest\.manage['"]\s*\)/,
    );
    // Session 260: an ACCEPTED judge, not any invitation row (a pending invite
    // used to read every judge's scores and feedback).
    expect(src, 'must check judge membership').toMatch(/getContestJudgeMembership\(/);
    expect(src, 'must require an accepted invitation').toMatch(/membership\?\.acceptedAt/);
    expect(src, 'must not grant privilege on a bare invitation').not.toMatch(/isContestJudge\(/);
    // Session 260: the advancement cut is open to per-contest editors, so they
    // are privileged readers of the field it cuts.
    expect(src, 'must check per-contest editor').toMatch(/isContestEditor\(/);
  });

  it('only forwards includeJudgeScores when the caller is privileged', () => {
    expect(src, 'must gate includeJudgeScores on privileged').toMatch(
      /includeJudgeScores:\s*privileged\s*&&\s*query\.includeJudgeScores/,
    );
  });

  it('gates aggregate score reveal through shouldRevealScores + judgingVisibility', () => {
    expect(src, 'must call shouldRevealScores with the contest visibility').toMatch(
      /revealScores\s*=\s*shouldRevealScores\(\s*contest\.judgingVisibility\s*,\s*contest\.status\s*,\s*privileged\s*\)/,
    );
    expect(src, 'must pass that decision to the listing').toMatch(/^\s*revealScores,\s*$/m);
  });

  it('does not let a viewer who cannot see scores sort by them (session 260)', () => {
    // `order=rank` orders by the live score; a hidden score must not be readable
    // from the order of the list.
    expect(src).toMatch(/query\.order === 'rank' && !revealScores && contest\.status !== 'completed' \? 'recent'/);
    expect(src).toMatch(/orderBy,/);
    expect(src, 'the raw query order must not reach the listing').not.toMatch(/orderBy:\s*query\.order/);
  });

  it('gives a judge only their own scores, not the rest of the panel (session 260)', () => {
    expect(src).toMatch(/item\.judgeScores\.filter\(\(s\) => s\.judgeId === user\.id\)/);
  });

  it('is feature-gated behind the contests flag', () => {
    expect(src, 'must call requireFeature("contests")').toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
  });
});
