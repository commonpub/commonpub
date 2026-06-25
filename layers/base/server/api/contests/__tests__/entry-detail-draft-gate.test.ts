/**
 * Static contract test for GET /api/contests/:slug/entries/:entryId.
 *
 * Locks the session-227 draft gate: a proposal DRAFT placeholder entry must not
 * be openable by direct URL. The entries LISTING already hides draft-backed
 * entries from non-privileged callers (session 226 A2), but the detail route had
 * no content-status filter, so a non-owner who guessed a draft entryId could read
 * its title / artifacts directly. The gate 404s unless the viewer is the entrant
 * or privileged.
 *
 * Source-string read (same pattern as entries-score-gating.test.ts) — a full
 * PGlite + nitro + better-auth harness for this handler isn't wired yet.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const handlerPath = resolve(__dirname, '..', '[slug]', 'entries', '[entryId]', 'index.get.ts');
const src = readFileSync(handlerPath, 'utf8');

describe('GET /api/contests/:slug/entries/:entryId — draft-entry gate', () => {
  it('404s a non-published-content entry for a non-entrant, non-privileged viewer', () => {
    // The guard must combine all three: content not published AND not privileged
    // AND not the entrant → 404.
    expect(src, 'must gate on contentStatus !== published').toMatch(
      /entry\.contentStatus\s*!==\s*['"]published['"]/,
    );
    expect(src, 'must exempt privileged viewers').toMatch(/!privileged/);
    expect(src, 'must exempt the entrant').toMatch(/!isEntrant/);
    expect(src, 'must throw a 404 (not a 403 that confirms existence)').toMatch(
      /statusCode:\s*404/,
    );
  });

  it('derives isEntrant from the entry owner before gating', () => {
    expect(src, 'must compute isEntrant from entry.userId').toMatch(
      /isEntrant\s*=\s*!!user\s*&&\s*user\.id\s*===\s*entry\.userId/,
    );
  });

  it('is feature-gated behind the contests flag', () => {
    expect(src, 'must call requireFeature("contests")').toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
  });
});
