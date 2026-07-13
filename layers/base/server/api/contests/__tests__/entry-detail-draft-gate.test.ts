/**
 * WIRING guard for GET /api/contests/:slug/entries/:entryId.
 *
 * The gate's actual BOOLEAN logic (draft + members/private → 404 unless entrant/privileged)
 * is the pure `canViewContestEntryDetail`, unit-tested for real in
 * `packages/server/src/__tests__/content-visibility-p1.integration.test.ts`. This file only
 * confirms the route WIRES that predicate, 404s (not 403), and is feature-gated — a
 * source read, since no PGlite+nitro+better-auth harness is wired for this handler.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(__dirname, '..', '[slug]', 'entries', '[entryId]', 'index.get.ts'),
  'utf8',
);

describe('GET /api/contests/:slug/entries/:entryId — route wiring', () => {
  it('delegates the read gate to canViewContestEntryDetail and 404s (not 403) on deny', () => {
    expect(src, 'route must call canViewContestEntryDetail(entry, ...)').toMatch(
      /canViewContestEntryDetail\(\s*entry\s*,/,
    );
    expect(src, 'must throw 404 (not a 403 that confirms existence)').toMatch(/statusCode:\s*404/);
  });

  it('derives isEntrant from the entry owner', () => {
    expect(src).toMatch(/isEntrant\s*=\s*!!user\s*&&\s*user\.id\s*===\s*entry\.userId/);
  });

  it('is feature-gated behind the contests flag', () => {
    expect(src).toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
  });
});
