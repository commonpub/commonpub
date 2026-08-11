import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { featureFlagsSchema } from '@commonpub/config';

/**
 * Guards `runtimeConfig.public.features` in the LAYER's nuxt.config.
 *
 * Nuxt only applies a `NUXT_PUBLIC_FEATURES_*` env override to keys that are
 * DECLARED in runtimeConfig. An undeclared key is silently ignored at runtime:
 * the flag still works via config and the DB override, so nothing looks broken,
 * but the env path is dead. That is exactly how commonpub.io's first canary
 * kept `layoutEngine: false` at SSR despite the env var being set on the
 * container, and by session 253 six flags had drifted out of the block with
 * nothing to catch it.
 *
 * The file is parsed as text rather than imported because nuxt.config.ts calls
 * `defineNuxtConfig`, which only exists inside Nuxt's build context.
 */
function layerNuxtConfig(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ['layers/base/nuxt.config.ts', '../../layers/base/nuxt.config.ts']) {
      try {
        return readFileSync(resolve(dir, rel), 'utf8');
      } catch { /* keep walking up */ }
    }
    dir = dirname(dir);
  }
  throw new Error(`layers/base/nuxt.config.ts not found from ${process.cwd()}`);
}

/** The keys declared inside the `features: { ... }` block of runtimeConfig.public. */
function declaredFeatureKeys(source: string): string[] {
  const start = source.indexOf('features: {');
  expect(start, 'runtimeConfig.public.features block not found').toBeGreaterThan(-1);

  // Walk braces so the nested `identity: { ... }` object is included whole and
  // the scan stops at the real end of the block.
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const block = source.slice(start, end);
  // Top-level keys only: skip anything indented deeper than the block's own keys.
  return [...block.matchAll(/^\s{8}([a-zA-Z][\w]*):/gm)].map((m) => m[1]);
}

const canonical = Object.entries(featureFlagsSchema.parse({}))
  .map(([key]) => key)
  .sort();

describe('layer runtimeConfig.public.features parity with FeatureFlags', () => {
  const declared = declaredFeatureKeys(layerNuxtConfig());

  it('declares every feature flag, so each one is env-overridable', () => {
    const missing = canonical.filter((k) => !declared.includes(k));
    expect(
      missing,
      `these flags are missing from layers/base/nuxt.config.ts runtimeConfig.public.features, so NUXT_PUBLIC_FEATURES_* is silently dropped for them:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('declares nothing that is not a real flag', () => {
    const stale = declared.filter((k) => !canonical.includes(k));
    expect(stale, `stale keys in the features block: ${stale.join(', ')}`).toEqual([]);
  });

  it('found a non-trivial block, so a parser change cannot make this vacuous', () => {
    // Without this the two assertions above would both pass against an empty
    // list if the brace-walk or the regex ever stopped matching.
    expect(declared.length).toBeGreaterThan(20);
    expect(declared).toContain('identity');
  });
});
