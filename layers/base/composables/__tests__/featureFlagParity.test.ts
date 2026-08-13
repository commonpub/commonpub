import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

/**
 * A feature flag lives in five hand-written places, and every one of them is a
 * silent failure when it drifts:
 *
 *   packages/config/src/schema.ts        the Zod source of truth
 *   packages/config/src/types.ts         the `FeatureFlags` interface
 *   layers/base/nuxt.config.ts           `public.features` — an UNDECLARED key
 *                                        gets no NUXT_PUBLIC_FEATURES_* env
 *                                        override, so the operator's env var is
 *                                        silently ignored
 *   layers/base/composables/useFeatures.ts   the client mirror + DEFAULT_FLAGS
 *   apps/reference/server/utils/envFlagMap.ts   the FEATURE_* env bridge
 *
 * types.ts is additionally covered at compile time by the assignment pair in
 * schema.ts, and envFlagMap.ts by apps/reference/__tests__/env-flag-map-parity,
 * but nuxt.config.ts and useFeatures.ts had no guard at all: four flags
 * (`seamlessFederation`, `federateHubs`, `adminBroadcast`,
 * `requireTermsAcceptance`) had been missing from the useFeatures mirror since
 * they were added. This sweep is the guard.
 *
 * It parses SOURCE rather than importing, because three of the five files
 * (a Nuxt config, a Nuxt composable, a Nitro util) cannot be imported outside
 * their framework. That makes a wrong path the obvious failure mode, so the
 * test carries its own guards (P7): it asserts it read all five files, that it
 * found at least MIN_FLAGS flags, and that its block extractor and key regex
 * still match a known-good and a known-bad input.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Floor, not the count. 42 flags predate the persona work, which added three,
 * and the member visibility directory adds `memberDirectory`. A parse that
 * silently narrows (a renamed `export const`, a changed brace style) drops
 * toward zero and must fail here rather than pass vacuously.
 *
 * This constant is the only place the number is written. Read it; do not
 * restate it in an assertion.
 */
const MIN_FLAGS = 46;

/**
 * Every flag that gates a persona surface. All default false, in all three
 * places that carry a default, because each one either starts collecting
 * personal data, starts disclosing it, or (for `memberDirectory`) discloses
 * IDENTIFIED members rather than k-anonymous counts. An upgrade must never turn
 * one on for an operator.
 */
const PERSONA_FLAGS = [
  'persona',
  'dataSharingConsents',
  'personaAnalytics',
  'memberDirectory',
] as const;

const FILES = {
  schema: 'packages/config/src/schema.ts',
  types: 'packages/config/src/types.ts',
  nuxtConfig: 'layers/base/nuxt.config.ts',
  useFeatures: 'layers/base/composables/useFeatures.ts',
  envFlagMap: 'apps/reference/server/utils/envFlagMap.ts',
} as const;

/** Every mirror file, read once. A missing file throws here, which is the point. */
const sources: Record<keyof typeof FILES, string> = Object.fromEntries(
  Object.entries(FILES).map(([name, rel]) => [name, readFileSync(resolve(repoRoot, rel), 'utf8')]),
) as Record<keyof typeof FILES, string>;

/**
 * Drop `//` and block comments so prose can never be mistaken for a key, and so
 * a brace in a doc comment cannot unbalance the block scan.
 *
 * Deliberately a scanner and not two regex replaces. The regex version was
 * written first and was wrong in a way that mattered: a line comment reading
 * "/api/persona/*" opens a block comment as far as a naive `\/\*[\s\S]*?\*\/`
 * is concerned, which swallowed the rest of the schema and its closing brace.
 * String literals are preserved so "https://..." and the FEATURE_ env names
 * survive, and so a `//` inside a string cannot blank a real line of code.
 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    const next = src[i + 1];
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      out += ch;
      i += 1;
      while (i < src.length && src[i] !== ch) {
        if (src[i] === '\\') {
          out += src[i]!;
          i += 1;
        }
        if (i < src.length) out += src[i]!;
        i += 1;
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * The body of the object/interface literal that starts at `opener`, found by
 * brace counting so a nested object cannot end the block early. Comments are
 * stripped FIRST, because a brace inside a doc comment would otherwise throw the
 * count off and silently truncate the block.
 */
export function extractBlock(rawSrc: string, opener: string): string {
  const src = stripComments(rawSrc);
  const start = src.indexOf(opener);
  if (start === -1) throw new Error(`block opener not found: ${opener}`);
  let depth = 0;
  for (let i = start + opener.length - 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start + opener.length, i);
    }
  }
  throw new Error(`unbalanced braces after: ${opener}`);
}

/** Every `key:` in a block, at any nesting depth. A superset, used for containment. */
export function keysIn(block: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripComments(block).matchAll(/([A-Za-z_$][\w$]*)\s*\??\s*:/g)) out.add(m[1]!);
  return out;
}

/** `key: declaration` pairs at exactly `indent` spaces, so nested keys are excluded. */
export function topLevelDeclarations(block: string, indent: number): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`^ {${indent}}([A-Za-z_$][\\w$]*)\\s*\\??\\s*:\\s*(.+)$`, 'gm');
  for (const m of stripComments(block).matchAll(re)) out.set(m[1]!, m[2]!.trim());
  return out;
}

const schemaFlags = topLevelDeclarations(
  extractBlock(sources.schema, 'export const featureFlagsSchema = z.object({'),
  2,
);
/** Canonical flag names, from the one file that is the source of truth. */
const CANONICAL = [...schemaFlags.keys()].sort();
/** Scalar booleans only. `identity` is a nested object and has no env bridge. */
const BOOLEAN_FLAGS = CANONICAL.filter((k) => schemaFlags.get(k)!.startsWith('z.boolean('));
/** Allowed in a mirror without being a top-level flag: the identity sub-flags. */
const IDENTITY_SUBFLAGS = new Set(
  topLevelDeclarations(
    extractBlock(sources.schema, 'export const identityFeaturesSchema = z.object({'),
    2,
  ).keys(),
);

/**
 * Each mirror, with the flag set it is required to carry. Four carry every flag;
 * `ENV_FLAG_MAP` carries the scalar booleans only, because an env var cannot
 * express the nested `identity` object and it is deliberately absent there.
 */
const mirrors: Array<{ label: string; keys: Set<string>; expected: string[] }> = [
  {
    label: FILES.types,
    keys: keysIn(extractBlock(sources.types, 'export interface FeatureFlags {')),
    expected: CANONICAL,
  },
  {
    label: `${FILES.nuxtConfig} public.features`,
    keys: keysIn(extractBlock(sources.nuxtConfig, 'features: {')),
    expected: CANONICAL,
  },
  {
    label: `${FILES.useFeatures} interface`,
    keys: keysIn(extractBlock(sources.useFeatures, 'export interface FeatureFlags {')),
    expected: CANONICAL,
  },
  {
    label: `${FILES.useFeatures} DEFAULT_FLAGS`,
    keys: keysIn(extractBlock(sources.useFeatures, 'export const DEFAULT_FLAGS: FeatureFlags = {')),
    expected: CANONICAL,
  },
  {
    label: FILES.envFlagMap,
    keys: keysIn(extractBlock(sources.envFlagMap, 'export const ENV_FLAG_MAP: Record<string, string> = {')),
    expected: BOOLEAN_FLAGS,
  },
];

describe('feature flag parity across every mirror', () => {
  it('read all five mirror files, none of them empty', () => {
    const names = Object.keys(FILES);
    expect(names).toHaveLength(5);
    for (const name of names) {
      expect(sources[name as keyof typeof FILES].length, `${name} is empty`).toBeGreaterThan(200);
    }
  });

  it('parsed a plausible number of flags out of the Zod source of truth', () => {
    expect(
      CANONICAL.length,
      `only parsed ${CANONICAL.length} flags from ${FILES.schema}; the parse is probably broken`,
    ).toBeGreaterThanOrEqual(MIN_FLAGS);
    // Spot-check both ends, so a regex that matched garbage cannot pass.
    expect(CANONICAL).toContain('content');
    expect(CANONICAL).toContain('identity');
    for (const flag of PERSONA_FLAGS) expect(CANONICAL).toContain(flag);
    // The stale-key check leans on this set, so an empty parse would turn that
    // check into a false alarm rather than a silent pass. Guard it too.
    expect([...IDENTITY_SUBFLAGS]).toEqual([
      'linkRemoteAccounts', 'signInWithRemote', 'actingAs', 'remoteInteract', 'remotePublish',
    ]);
    expect(BOOLEAN_FLAGS).not.toContain('identity');
    expect(BOOLEAN_FLAGS.length).toBe(CANONICAL.length - 1);
  });

  it.each(mirrors)('$label declares every flag', ({ label, keys, expected }) => {
    expect(expected.length, `${label} has no expected flags; the parse is broken`)
      .toBeGreaterThanOrEqual(MIN_FLAGS - 1);
    const missing = expected.filter((flag) => !keys.has(flag));
    expect(
      missing,
      missing.length
        ? `${label} is missing: ${missing.join(', ')}. Add them, or the flag cannot be set there.`
        : '',
    ).toEqual([]);
  });

  it.each(mirrors)('$label declares nothing the schema does not', ({ label, keys }) => {
    const stale = [...keys].filter((k) => !schemaFlags.has(k) && !IDENTITY_SUBFLAGS.has(k));
    expect(stale, stale.length ? `${label} has stale keys: ${stale.join(', ')}` : '').toEqual([]);
  });

  it('bridges every boolean flag to a distinct FEATURE_ env var', () => {
    const map = extractBlock(sources.envFlagMap, 'export const ENV_FLAG_MAP: Record<string, string> = {');
    const names = [...stripComments(map).matchAll(/:\s*'([A-Z0-9_]+)'/g)].map((m) => m[1]!);
    expect(names.length).toBe(BOOLEAN_FLAGS.length);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^FEATURE_[A-Z0-9_]+$/);
  });

  it('every persona flag, the directory included, defaults to false everywhere', () => {
    for (const flag of PERSONA_FLAGS) {
      expect(schemaFlags.get(flag), `${flag} in ${FILES.schema}`).toBe('z.boolean().default(false),');
    }
    const nuxt = topLevelDeclarations(extractBlock(sources.nuxtConfig, 'features: {'), 8);
    const defaults = extractBlock(sources.useFeatures, 'export const DEFAULT_FLAGS: FeatureFlags = {');
    for (const flag of PERSONA_FLAGS) {
      expect(nuxt.get(flag), `${flag} in ${FILES.nuxtConfig}`).toBe('false,');
      expect(stripComments(defaults)).toMatch(new RegExp(`\\b${flag}:\\s*false\\b`));
    }
  });

  it('accepts persona and dataSharing as opaque config passthroughs', () => {
    const cfg = extractBlock(sources.schema, 'export const configSchema = z.object({');
    const decls = topLevelDeclarations(cfg, 2);
    expect(decls.get('persona')).toBe('z.unknown().optional(),');
    expect(decls.get('dataSharing')).toBe('z.unknown().optional(),');
    // The whole point of the passthrough: config must not learn persona's
    // vocabulary. Naming the package in a comment is fine; importing it is not,
    // because config is the package everything else depends on.
    const IMPORTS_A_PACKAGE = /(?:^|\n)\s*import[^\n;]*from\s*['"]@commonpub\//;
    expect(IMPORTS_A_PACKAGE.test(sources.schema)).toBe(false);
    expect(IMPORTS_A_PACKAGE.test(sources.types)).toBe(false);
    // Positive control on that regex, so a typo cannot read as "imports nothing".
    expect(IMPORTS_A_PACKAGE.test("import { x } from '@commonpub/persona';")).toBe(true);
  });

  it('detects the drift it is looking for', () => {
    // Positive controls, so a broken extractor cannot read as a clean tree.
    expect([...keysIn('  a: true,\n  b: { c: 1 },\n')]).toEqual(['a', 'b', 'c']);
    expect(keysIn('  // notAFlag: true\n  real: true,\n').has('notAFlag')).toBe(false);
    expect(keysIn('  /** doc: text */\n  real: true,\n').has('doc')).toBe(false);
    // A glob in a line comment must not open a block comment (this bit once).
    expect(stripComments('  // gates /api/persona/*\n  a: 1,\n  // b\n}')).toBe('  \n  a: 1,\n  \n}');
    // A "//" inside a string literal is not a comment.
    expect(stripComments("const u = 'https://x/y'; // c")).toBe("const u = 'https://x/y'; ");
    expect([...topLevelDeclarations('  a: 1,\n    nested: 2,\n', 2).keys()]).toEqual(['a']);
    expect(extractBlock('const x = {\n  a: { b: 1 },\n};', 'const x = {')).toBe('\n  a: { b: 1 },\n');
    expect(() => extractBlock('const y = {};', 'const nope = {')).toThrow();
  });
});
