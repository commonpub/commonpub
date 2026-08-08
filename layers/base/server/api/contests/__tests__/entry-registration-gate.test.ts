/**
 * Static contract test for the session-250 registration gate on the two contest
 * ENTRY-CREATING routes (`POST /entries`, `POST /proposal`).
 *
 * The invariant: an entry may only be created for a participant who has been
 * through the registration flow. That flow is the ONLY place the contest's
 * required fields are enforced and its agreements are written to the consent log —
 * without the gate, `submitContestEntry` / `submitContestProposal` silently upsert
 * the entrant as a counted `full` registrant who accepted nothing (the hole
 * documented in session 249 as "left as-is, fix if it becomes UI-reachable").
 *
 * Source-string reads, mirroring the sibling by-route guards (entries-score-gating,
 * entry-detail-draft-gate) — a full PGlite + nitro + better-auth harness for these
 * handlers isn't wired yet. The tier lookup's own behaviour is covered by
 * `getRegistrationTier` in packages/server's contest integration tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = [
  { name: 'POST /api/contests/:slug/entries', file: 'entries.post.ts' },
  { name: 'POST /api/contests/:slug/proposal', file: 'proposal.post.ts' },
];

describe.each(routes)('$name — registration precondition', ({ file }) => {
  const src = readFileSync(resolve(__dirname, '..', '[slug]', file), 'utf8');

  it('imports the tier lookup from @commonpub/server', () => {
    expect(src, 'must import getRegistrationTier').toMatch(
      /import\s*\{[^}]*getRegistrationTier[^}]*\}\s*from\s*'@commonpub\/server'/s,
    );
  });

  it('reads the caller’s tier for THIS contest and THIS user', () => {
    expect(src).toMatch(/getRegistrationTier\(\s*db\s*,\s*contest\.id\s*,\s*user\.id\s*\)/);
  });

  it('rejects anything short of a `full` registration with a 403', () => {
    // `reminders` (following the contest) must NOT pass: a follower has accepted
    // no agreements and answered no required fields.
    expect(src).toMatch(/tier\s*!==\s*'full'/);
    expect(src).toMatch(/statusCode:\s*403/);
    expect(src).toMatch(/Register for this contest before submitting/);
  });

  it('is gated on the contestEntryRequiresRegistration flag (rule #2), default ON', () => {
    // `!== false` (not a truthy check) so an instance whose merged flags omit the
    // key still gets the safe behaviour.
    expect(src).toMatch(/features\.contestEntryRequiresRegistration\s*!==\s*false/);
  });

  it('runs the gate BEFORE the entry is created', () => {
    const gateAt = src.indexOf('getRegistrationTier');
    const submitAt = src.search(/submitContestEntry\(|submitContestProposal\(/);
    expect(gateAt).toBeGreaterThan(-1);
    expect(submitAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(submitAt);
  });
});
