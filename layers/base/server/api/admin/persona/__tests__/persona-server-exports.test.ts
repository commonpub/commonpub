/**
 * The layer's persona routes reach `@commonpub/persona` ONLY through
 * `@commonpub/server`.
 *
 * THE RULE IS ABOUT THIS DIRECTORY, NOT ABOUT THE LAYER. `layers/base` DOES
 * depend on `@commonpub/persona`, and
 * `layers/base/server/api/consent/__tests__/purposes-contract.test.ts` pins that
 * from the other side by asserting the dependency IS declared in `package.json`.
 * It has to be: Vue components cannot import a Node-only package, and
 * `PersonaFieldInput`, `PersonaSectionEditor`, `PersonaChipGrid` and the persona
 * pages all import `personaFieldSpec`, `personaCompleteness`, `httpUrl` and the
 * types directly.
 *
 * What this file protects is narrower and still worth protecting: the persona
 * ADMIN routes take ONE dependency edge, so a fork wiring them up needs one
 * package, and anything they call from the persona brain must be re-exported by
 * the server barrel.
 *
 * This is a test rather than a line in a report because a report does not fail a
 * build, and a missing re-export does not fail at import time either. It fails at
 * the moment an operator presses Save, as `personaSectionsSchema is not a
 * function`, on a route whose whole job is refusing bad input.
 *
 * (An earlier version of this header claimed the layer does NOT declare
 * `@commonpub/persona`, and cited the sibling test as proof; the sibling asserts
 * the opposite and the dependency has always been there. Two tests telling a
 * maintainer opposite things is worse than neither.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repo root (pnpm-workspace.yaml) not found above ${from}`);
}

const repoRoot = findRepoRoot(__dirname);

const BARRELS = ['packages/server/src/index.ts', 'packages/server/src/persona/index.ts'] as const;

const barrels = BARRELS.map((rel) => ({
  rel,
  src: readFileSync(resolve(repoRoot, rel), 'utf8'),
}));

/** Every persona-owned value the routes in this directory call at runtime. */
const REQUIRED = ['personaSectionsSchema', 'personaFieldSink'] as const;

/**
 * Values these routes call that `@commonpub/server` OWNS (rather than re-exports
 * from the brain package). They still have to be on a barrel, and a missing one
 * fails the same way at the same moment.
 */
const REQUIRED_SERVER_OWNED = [
  'planPersonaSchemaChange',
  'flattenPersonaFields',
  'personaSchemaChangeCandidates',
] as const;

/**
 * Modules the persona barrel re-exports WHOLESALE. `bandPersonaCount` (the
 * k-anonymity band every count crossing an HTTP boundary goes through) lives in
 * one of them, and a name inside a `export *` cannot be scanned for, so the
 * scan is for the star itself.
 */
const REQUIRED_STAR_EXPORTS = ["export * from './metrics.js'"] as const;

describe('@commonpub/server re-exports what the persona admin routes call', () => {
  it('read both server barrels (P7)', () => {
    expect(barrels).toHaveLength(BARRELS.length);
    for (const { rel, src } of barrels) {
      expect(src.length, `${rel} is empty or unreadable; check the path`).toBeGreaterThan(200);
    }
  });

  it.each(REQUIRED)('re-exports %s from @commonpub/persona', (name) => {
    const pattern = new RegExp(
      `export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'@commonpub/persona'`,
      's',
    );
    expect(
      barrels.some(({ src }) => pattern.test(src)),
      'Add to packages/server/src/persona/index.ts (or src/index.ts):\n'
        + `  export { ${REQUIRED.join(', ')} } from '@commonpub/persona';\n`
        + 'layers/base/server/api/admin/persona/schema.put.ts calls both, and\n'
        + '@commonpub/layer deliberately does not depend on @commonpub/persona.',
    ).toBe(true);
  });

  it.each(REQUIRED_SERVER_OWNED)('exports %s, which the routes also call', (name) => {
    const pattern = new RegExp(`\\b${name}\\b`);
    expect(
      barrels.some(({ src }) => pattern.test(src)),
      `Add ${name} to packages/server/src/persona/index.ts.`,
    ).toBe(true);
  });

  it.each(REQUIRED_STAR_EXPORTS)('keeps %s on the persona barrel', (line) => {
    const barrel = barrels.find((b) => b.rel.endsWith('persona/index.ts'));
    expect(barrel?.src).toContain(line);
  });

  it('the route imports its persona surface from the server package', () => {
    const src = readFileSync(resolve(__dirname, '..', 'schema.put.ts'), 'utf8');
    expect(src.length).toBeGreaterThan(500);
    expect(src).not.toContain("from '@commonpub/persona'");
    // `personaSectionsSchema` is called directly; `personaFieldSink` reaches the
    // route only through `planPersonaSchemaChange` now, which is the point of
    // moving the analysis into the package, so the barrel requirement above is
    // what carries it rather than a literal in this file.
    expect(src).toContain('personaSectionsSchema');
    expect(src).toContain('planPersonaSchemaChange');
  });

  it('no persona route in this directory reaches the persona package directly', () => {
    const routes = ['schema.get.ts', 'schema.put.ts', 'schema.delete.ts', 'drift/[fieldKey].post.ts'];
    let walked = 0;
    for (const rel of routes) {
      const src = readFileSync(resolve(__dirname, '..', rel), 'utf8');
      expect(src.length, `${rel} is empty; check the path`).toBeGreaterThan(200);
      expect(src, `${rel} must not import @commonpub/persona`).not.toContain(
        "from '@commonpub/persona'",
      );
      walked += 1;
    }
    // P7: a broken path would make the loop above vacuous.
    expect(walked).toBe(routes.length);
  });
});
