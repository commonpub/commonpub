import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { METRICS_MIN_BUCKET as PERSONA_MIN_BUCKET } from '@commonpub/persona';
import { describe, expect, it } from 'vitest';

import { METRICS_MIN_BUCKET as PUBLIC_API_MIN_BUCKET } from '../metrics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const METRICS_FILE = resolve(HERE, '../metrics.ts');
const THRESHOLDS_FILE = resolve(HERE, '../../../../persona/src/thresholds.ts');

/**
 * Audit B5 wanted one k-anonymity floor. There are two declarations of it.
 *
 * `@commonpub/persona` owns the constant (it has to: `@commonpub/config`'s Zod
 * `.min()` calls reference it, and config cannot import the server package).
 * `packages/server/src/publicApi/metrics.ts` has declared its own literal `5`
 * since Phase 2 and predates persona entirely.
 *
 * The package's PUBLIC value is already unambiguous: `src/index.ts` re-exports
 * the persona constant by name, because two star exports carrying one name
 * would otherwise drop it. What is left is two independent fives INSIDE the
 * package, and nothing that notices if one of them moves.
 *
 * Collapsing them is a one-line edit to a file this change deliberately did not
 * touch (it is on the untouched-file list for this feature, alongside
 * `metricsRollup.ts`). So the drift is pinned instead of merged: if either five
 * moves, this fails and names the fix. Deleting the local declaration and
 * re-exporting the persona constant is what makes this test unnecessary.
 */
describe('the k-anonymity floor has one value, however many declarations', () => {
  it('read both declaration sites (P7)', () => {
    for (const file of [METRICS_FILE, THRESHOLDS_FILE]) {
      const source = readFileSync(file, 'utf8');
      expect(source.length, `${file} is missing or empty; check the path`).toBeGreaterThan(200);
      expect(source, `${file} no longer declares METRICS_MIN_BUCKET`)
        .toContain('METRICS_MIN_BUCKET');
    }
  });

  it('the public API floor equals the persona floor', () => {
    expect(
      PUBLIC_API_MIN_BUCKET,
      'packages/server/src/publicApi/metrics.ts declares its own METRICS_MIN_BUCKET literal and it '
      + 'has drifted from @commonpub/persona\'s. Fix by deleting the local declaration and writing:\n'
      + "  export { METRICS_MIN_BUCKET } from '@commonpub/persona';\n"
      + 'then delete the explicit re-export in packages/server/src/index.ts that disambiguates the '
      + 'two star exports, and delete this test.',
    ).toBe(PERSONA_MIN_BUCKET);
  });

  it('the floor is a real floor, not zero', () => {
    // A zero floor publishes a bucket of one. Pinned so a "temporarily lower it
    // for testing" change cannot ship quietly.
    expect(PERSONA_MIN_BUCKET).toBeGreaterThanOrEqual(5);
  });
});
