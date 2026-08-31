/**
 * Every CSV download must start with a UTF-8 BOM, and the BOM must be written
 * as an escape rather than as a literal character.
 *
 * WHY THIS EXISTS. Excel guesses the encoding of a .csv it opens, and without a
 * leading U+FEFF it guesses the system codepage. A contest entries export then
 * renders every non-ASCII name as mojibake for the organiser, which is the one
 * moment the file matters. Both export routes carry the BOM deliberately.
 *
 * WHY IT CHECKS THE SPELLING, NOT JUST THE PRESENCE. Until 2026-08-30 both
 * routes contained the BOM as a LITERAL U+FEFF inside a template literal --
 * an invisible character, indistinguishable on screen from nothing at all.
 * Nothing in the repo asserted it, `eslint` had never seen these files (the
 * layer had no lint script), and any editor, formatter, or well-meaning
 * "strip invisible characters" pass would have deleted it silently. The
 * escaped form `﻿` produces the identical byte sequence and is visible
 * in a diff.
 *
 * It DISCOVERS the routes by scanning for the CSV content type rather than
 * naming the two that exist today, so a third export added tomorrow is covered
 * without anyone remembering to add it here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SERVER_ROOT = resolve(__dirname, '..', '..', '..');

/** Floor, not the count: two CSV routes exist today. A scan that silently
 *  narrows to zero must fail here rather than pass over an empty set. */
const MIN_CSV_ROUTES = 2;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p, out);
    } else if (p.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

const csvRoutes = walk(SERVER_ROOT)
  .map((path) => ({ path, src: readFileSync(path, 'utf8') }))
  .filter(({ src }) => /['"`]text\/csv/.test(src));

describe('CSV export routes', () => {
  it('found the routes it means to check', () => {
    expect(
      csvRoutes.length,
      `scanned ${SERVER_ROOT} and found ${csvRoutes.length} routes serving text/csv`,
    ).toBeGreaterThanOrEqual(MIN_CSV_ROUTES);
  });

  it.each(csvRoutes.map((r) => [r.path.replace(SERVER_ROOT, 'server'), r.src] as const))(
    '%s emits a UTF-8 BOM, written as an escape',
    (_label, src) => {
      // The escape, spelled out. Matches `﻿` in any case.
      expect(src, 'no \\uFEFF escape found before the CSV body').toMatch(/\\u\{?0*FEFF\}?/i);
      // And not the raw character, which is invisible and silently strippable.
      expect(
        src.includes('﻿'),
        'contains a LITERAL U+FEFF; write it as the escape \\uFEFF instead so it survives formatting and shows up in a diff',
      ).toBe(false);
    },
  );
});
