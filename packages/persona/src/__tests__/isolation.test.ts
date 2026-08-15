import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..');
const REPO_ROOT = resolve(SRC, '../../..');

/** Every shipped source file, tests excluded: they are allowed node and vitest. */
function shippedSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...shippedSourceFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith('.ts')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const IMPORT_SPECIFIER = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const BARE_IMPORT = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const re of [IMPORT_SPECIFIER, BARE_IMPORT, DYNAMIC_IMPORT, REQUIRE]) {
    re.lastIndex = 0;
    let match = re.exec(source);
    while (match !== null) {
      if (match[1]) found.push(match[1]);
      match = re.exec(source);
    }
  }
  return found;
}

/** Reads a repo file and refuses to hand back nothing, so a wrong path fails loudly (P7). */
function readRepoFile(rel: string, minBytes = 200): string {
  const source = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  expect(source.length, `${rel} is missing or empty; check the path`).toBeGreaterThan(minBytes);
  return source;
}

/** Every file under a repo directory matching an extension, recursively. */
function filesUnder(rel: string, extensions: string[]): string[] {
  const root = resolve(REPO_ROOT, rel);
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  };
  expect(statSync(root).isDirectory(), `${rel} is not a directory; check the path`).toBe(true);
  walk(root);
  return out;
}

/**
 * Strips comments so a sweep matches on CODE.
 *
 * String-aware, because the naive `\/\*[\s\S]*?\*\/` swallows a file the moment
 * a line comment contains `/*`, and a swallowed file scans clean.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          out += source[i]! + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += source[i]!;
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Does this source refer to the persona FEATURE?
 *
 * A bare case-insensitive `includes('persona')` is wrong, and quietly so: it
 * matches "personal data", which the contest engine says fourteen times because
 * partitioning personal data is what that engine does. A scanner that fires on
 * a word the target legitimately uses gets its target added to an exemption
 * list, and then it guards nothing.
 *
 * So: the package name, the word `persona` on its own, and `persona`/`Persona`
 * as an identifier prefix (`PersonaSection`, `personaFieldSink`,
 * `persona_metrics_daily`). "personal" matches none of those.
 */
function mentionsPersona(source: string): boolean {
  return (
    source.includes('@commonpub/persona')
    || /\bpersona\b/i.test(source)
    || /\bpersona[A-Z_]/.test(source)
    || /\bPersona[A-Z_]/.test(source)
  );
}

/**
 * Section 14.7. Five assertions, each one a decision this feature made about
 * what it would NOT touch.
 *
 * The goal the operator set for this feature: it must be changeable later
 * without breaking anything around it. Every assertion below is a boundary that
 * makes that true, and each one carries the reason it exists. A future change
 * that wants to undo one of these decisions deletes an assertion that says why
 * it was made, rather than discovering the reason in production.
 */
describe('the scanners themselves', () => {
  // Every assertion below this point is only worth its runtime if these two
  // helpers work. A matcher that never fires and a stripper that swallows a
  // file both look exactly like a clean tree.
  it('mentionsPersona fires on the feature and not on "personal data"', () => {
    for (const yes of [
      "import { x } from '@commonpub/persona';",
      'const s: PersonaSection = a;',
      'personaFieldSink(field)',
      'persona_metrics_daily',
      '// persona is deliberately absent',
    ]) {
      expect(mentionsPersona(yes), yes).toBe(true);
    }
    for (const no of [
      'stored as personal data, not on the artifact',
      'const personal: FieldType[] = [];',
      'Personal data (store privately)',
      'personalise the digest',
    ]) {
      expect(mentionsPersona(no), no).toBe(false);
    }
  });

  it('stripComments survives the traps that make a naive stripper pass green', () => {
    // A line comment containing a block opener. The naive
    // `/\*[\s\S]*?\*/` eats the rest of the file from here, and a file that is
    // gone scans clean.
    expect(stripComments('// see /api/persona/*\nconst a = 1;')).toContain('const a = 1;');
    // A comment opener inside a string is not a comment.
    expect(stripComments('const s = "/* not a comment */";')).toContain('/* not a comment */');
    // A `//` inside a URL string survives.
    expect(stripComments("const u = 'https://example.com/x';")).toContain('https://example.com/x');
    // An escaped quote does not end the string early.
    expect(stripComments("const s = 'it\\'s fine'; // gone")).not.toContain('gone');
    // And a real comment does go.
    expect(stripComments('const a = 1; /* persona */')).not.toContain('persona');
  });
});

describe('14.7 (1) — @commonpub/persona imports nothing but zod', () => {
  const files = shippedSourceFiles(SRC);

  it('walked the whole shipped source tree', () => {
    // Guard the guard: a broken path scans zero files and passes green.
    expect(files.length).toBeGreaterThanOrEqual(7);
    const names = files.map((f) => f.split('/').pop());
    for (const expected of [
      'index.ts',
      'fields.ts',
      'persona.ts',
      'purposes.ts',
      'schemas.ts',
      'digest.ts',
      'thresholds.ts',
      'url.ts',
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it('imports nothing but zod and its own relative modules', () => {
    const offenders: string[] = [];
    let checkedFiles = 0;

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.length, file).toBeGreaterThan(0);
      checkedFiles += 1;

      for (const spec of specifiers(source)) {
        if (spec === 'zod') continue;
        if (spec.startsWith('./') || spec.startsWith('../')) continue;
        offenders.push(`${file.slice(SRC.length + 1)} -> ${spec}`);
      }
    }

    expect(checkedFiles).toBe(files.length);
    expect(offenders).toEqual([]);
  });

  it('declares zod as its only runtime dependency', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(SRC, '../package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; name?: string };
    expect(pkg.name).toBe('@commonpub/persona');
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['zod']);
  });

  it('names no framework, no ORM and no sibling package anywhere in its source', () => {
    // Named explicitly, including subpath imports and type-only imports, so the
    // failure message says WHICH boundary was crossed rather than only that one
    // was. If one of these ever needs to appear, deleting the entry here is the
    // moment to explain why.
    const banned = [
      '@commonpub/schema',
      '@commonpub/server',
      '@commonpub/config',
      '@commonpub/ui',
      'drizzle-orm',
      'h3',
      'nuxt',
      'vue',
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const spec of specifiers(source)) {
        const hit = banned.find((name) => spec === name || spec.startsWith(`${name}/`));
        if (hit) offenders.push(`${file.slice(SRC.length + 1)} -> ${hit}`);
      }
    }
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(offenders).toEqual([]);
  });
});

/**
 * The tables import nothing from this package.
 *
 * `packages/schema` is a pure table catalog: `drizzle.config.ts` globs
 * `./src/*.ts`, and every one of its 20 domain files is Drizzle plus its own
 * local types. If the tables imported the brain, `drizzle-kit generate` would
 * depend on a feature package, and the one-way dependency direction that makes
 * this feature removable would become a cycle.
 *
 * The cost is real and is accepted deliberately: `PurposeScopeSnapshot` is
 * declared twice, once as an interface in the table module and once as a Zod
 * shape here. `contest.ts` does the same for `ContestRegistrationFields`. The
 * drift that costs is caught by the parity guard in `packages/server`'s
 * `consent.ts`, which type-checks its validated shape against the schema's
 * interface in both directions.
 */
describe('14.7 (2) — packages/schema/src/persona.ts imports nothing from @commonpub/persona', () => {
  const rel = 'packages/schema/src/persona.ts';

  it('read the table module (P7)', () => {
    const source = readRepoFile(rel, 1000);
    expect(source, 'the four tables should all be here').toContain('user_persona_answers');
    expect(source).toContain('user_purpose_consents');
  });

  it('imports only drizzle-orm and its own siblings', () => {
    const source = readRepoFile(rel, 1000);
    const specs = specifiers(source);
    expect(specs.length, 'no import specifiers found; the extractor is broken').toBeGreaterThan(0);
    const offenders = specs.filter(
      (spec) =>
        spec !== 'drizzle-orm'
        && !spec.startsWith('drizzle-orm/')
        && !spec.startsWith('./')
        && !spec.startsWith('../'),
    );
    expect(offenders, 'the tables must import nothing but drizzle and their siblings').toEqual([]);
  });

  it('never names @commonpub/persona in code', () => {
    // Comment-stripped: the file explains the boundary in prose, which is the
    // point. Deleting the explanation to satisfy a naive scanner is the wrong
    // fix, so the scanner reads code.
    const code = stripComments(readRepoFile(rel, 1000));
    expect(code.length).toBeGreaterThan(500);
    expect(code).not.toContain('@commonpub/persona');
  });
});

/**
 * The shared metrics rollup is untouched.
 *
 * `runDailyRollup` is a hardcoded body with one `upsertRows` call and no pass
 * registry, and `TIMESERIES_METRICS` is a flat record served by
 * `/metrics/timeseries` under `read:analytics` alone. Persona writing into
 * `metrics_daily` would have meant editing that body AND adding a `persona.%`
 * rejection to the timeseries route to stop cohort data leaking through a scope
 * that was never granted for it.
 *
 * Persona owns `persona_metrics_daily` instead, so that back door never exists
 * and this file never changes.
 */
describe('14.7 (3) — the shared metrics rollup never mentions persona', () => {
  const rel = 'packages/server/src/publicApi/metricsRollup.ts';

  it('read the rollup (P7)', () => {
    const source = readRepoFile(rel, 500);
    expect(source, 'this should still be the shared rollup').toContain('runDailyRollup');
  });

  it('contains no reference to persona, in code or in prose', () => {
    // NOT comment-stripped, and deliberately so. This file is supposed to be
    // untouched by this feature, so even a comment mentioning persona means
    // someone reached in.
    const source = readRepoFile(rel, 500);
    expect(mentionsPersona(source), 'the shared rollup must not know persona exists').toBe(false);
  });
});

/**
 * The contest form engine is untouched.
 *
 * Persona shares almost nothing behavioural with it: no `required`, no `pii`,
 * no `isFormFieldPii`, no `isRequiredFormField`, its own renderer and its own
 * editor. What the two share is a list of field type NAMES. Merging the two
 * type unions to express that would have refactored a live system (a contest is
 * running on deveco) in exchange for cosmetic unity, so `@commonpub/persona`
 * declares its own `PERSONA_FIELD_TYPES` and the contest engine does not know
 * this feature exists.
 */
describe('14.7 (4) — the contest engine never mentions persona', () => {
  it('packages/schema/src/contest.ts is clean, and is still the contest module (P7)', () => {
    const source = readRepoFile('packages/schema/src/contest.ts', 1000);
    expect(source, 'this should still be the contest module').toContain('isFormFieldPii');
    expect(mentionsPersona(source), 'contest.ts must not know persona exists').toBe(false);
  });

  it('every contest component is clean', () => {
    const files = filesUnder('layers/base/components/contest', ['.vue', '.ts']);
    // Guard: a wrong path walks nothing and passes green.
    expect(files.length, 'no contest components found; check the path').toBeGreaterThanOrEqual(10);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.length, file).toBeGreaterThan(0);
      if (mentionsPersona(source)) {
        offenders.push(file.slice(REPO_ROOT.length + 1));
      }
    }
    expect(offenders, 'the contest engine must not learn about persona').toEqual([]);
  });
});

/**
 * The cookie-consent composable is unchanged by this feature.
 *
 * The rule 14.4 wrote is about the FNV body: any drift between the composable's
 * `scopeDigest` and this package's `fnv1a32` silently invalidates every stored
 * cookie consent on all three instances, re-asking every visitor for no reason.
 * That is why persona carries its own eight-line copy instead of lifting the
 * shared one out of a file on the critical path of a live GDPR surface.
 *
 * Three things are asserted, and together they say "unchanged by this feature"
 * more precisely than a file hash would. A hash also fails on a legitimate
 * unrelated edit (disclosing a new cookie, say), which trains a reader to
 * update the number rather than to think about it.
 *
 * 1. The composable names nothing from this feature.
 * 2. Its FNV body is byte-identical to this package's, whitespace and
 *    identifier naming aside.
 * 3. The consent scope is still computed over cookie purposes and processors
 *    only, so no persona purpose has been folded into the ePrivacy digest.
 *    Cookie consent answers an ePrivacy question about an anonymous visitor's
 *    device; a purpose consent answers a GDPR Art. 6(1)(a) question about a
 *    logged-in person's submitted data. They are separate records on purpose.
 */
describe('14.7 (5) — useCookieConsent.ts is unchanged by this feature', () => {
  const rel = 'layers/base/composables/useCookieConsent.ts';

  it('read the composable, and it is still the consent composable (P7)', () => {
    const source = readRepoFile(rel, 2000);
    expect(source).toContain('function scopeDigest');
    expect(source).toContain('useCookieConsent');
  });

  it('carries no persona logic, and its one persona mention is a cookie disclosure', () => {
    const source = readRepoFile(rel, 2000);

    // No import, no schema, no purpose logic. This is the part that matters:
    // the two consent regimes stay separate records with separate lifecycles.
    expect(source, 'the cookie composable must not import the persona package')
      .not.toMatch(/@commonpub\/persona/);
    for (const token of ['purposeConsent', 'user_purpose_consents', 'profile_analytics', 'dataSharing']) {
      expect(source, `${token} must not appear in the cookie consent composable`)
        .not.toContain(token);
    }

    // The ONE sanctioned exception (plan section 14.4). The persona invitation
    // writes `cpub-persona-invite-dismissed`, and a cookie this app sets must be
    // disclosed on /cookies or the policy page is wrong. Declaring it here is the
    // only way to disclose it. It is safe because `currentScope` digests
    // NON-ESSENTIAL cookies only, so an essential entry cannot move the consent
    // digest and cannot re-prompt anyone.
    //
    // This assertion pins the exception rather than banning the word, so folding
    // real persona logic in here still fails, and so does shipping the cookie
    // under any category that WOULD move the digest.
    const mentions = source
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => mentionsPersona(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*'));

    expect(mentions.length, `expected exactly one persona line, got: ${mentions.map((m) => `${m.n}:${m.line.trim()}`).join(' | ')}`)
      .toBe(1);
    expect(mentions[0]?.line).toContain('cpub-persona-invite-dismissed');

    // ...and it is declared essential. A functional/analytics category here
    // would silently invalidate every stored cookie consent on every instance.
    const entry = source.slice(source.indexOf('cpub-persona-invite-dismissed'));
    const category = entry.slice(0, entry.indexOf('},')).match(/category:\s*'(\w+)'/)?.[1];
    expect(category, 'the persona invite cookie must be essential').toBe('essential');
  });

  it('its FNV-1a body is byte-identical to this package fnv1a32', () => {
    const body = (source: string, fnName: string): string => {
      const start = source.indexOf(`function ${fnName}`);
      expect(start, `${fnName} not found`).toBeGreaterThan(-1);
      const open = source.indexOf('{', start);
      let depth = 0;
      let end = open;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const raw = source.slice(open + 1, end);
      // Comments and whitespace differ (the composable explains ePrivacy, this
      // package explains consent scope); the ARITHMETIC must not.
      return stripComments(raw).replace(/\s+/g, ' ').trim();
    };

    const composable = body(readRepoFile(rel, 2000), 'scopeDigest');
    const ours = body(readFileSync(resolve(SRC, 'digest.ts'), 'utf8'), 'fnv1a32');

    expect(composable.length, 'the FNV body extractor returned nothing').toBeGreaterThan(80);
    expect(ours).toBe(composable);
  });

  it('its consent scope still covers cookie purposes and processors only', () => {
    const source = readRepoFile(rel, 2000);
    // The digest input, verbatim from the file. A persona purpose folded in
    // here would re-ask every visitor for cookies whenever a section changed,
    // and would record one answer as if it covered both regimes.
    expect(source).toContain('hasNonEssentialCookies');
    expect(source).toMatch(/scopeDigest\(/);
    expect(source).not.toMatch(/scopeDigest\([^)]*purpose/i);
  });
});
