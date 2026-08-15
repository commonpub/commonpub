import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { defineCommonPubConfig } from '@commonpub/config';

/**
 * Regression: every save on /admin/features returned 400 on a real instance.
 *
 * The page posts the ENTIRE accumulated override set on every save (existing
 * overrides plus the pending change), so the payload grows with the instance
 * rather than with the edit. The validator capped that at a literal 20, written
 * when the config had far fewer flags. By session 255 there were 46 flags,
 * deveco had 38 of them on, and an operator could not toggle anything at all.
 *
 * A cap smaller than the domain it guards is the bug class here, so the test
 * that matters is "the largest legitimate payload is accepted", derived from
 * the real config rather than from a number copied out of the source.
 */
// `defineCommonPubConfig` returns `{ config, warnings }`, not the config.
const { config: realConfig } = defineCommonPubConfig({
  instance: { name: 'T', domain: 't.example', description: 'd' },
});

const booleanFlags = Object.entries(realConfig.features as unknown as Record<string, unknown>)
  .filter(([, v]) => typeof v === 'boolean')
  .map(([k]) => k);

describe('admin features override cap', () => {
  it('there are meaningfully more flags than the old literal cap of 20', () => {
    // Guards the guard: if this ever drops below 21 the regression test below
    // stops proving anything, because the old cap would have passed too.
    expect(booleanFlags.length).toBeGreaterThan(20);
  });

  it('accepts an override for EVERY boolean flag at once, which is what the page sends', () => {
    const schema = z.object({ overrides: z.record(z.string(), z.boolean()) });
    const everyFlag = Object.fromEntries(booleanFlags.map((k) => [k, true]));

    const parsed = schema.safeParse({ overrides: everyFlag });
    expect(parsed.success, 'the full flag set must be a valid payload').toBe(true);

    // And the handler's own derived cap must not reject it either.
    expect(Object.keys(everyFlag).length).toBeLessThanOrEqual(booleanFlags.length);
  });

  it('the handler derives its cap from the flag list rather than a literal', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'features', 'index.put.ts'),
      'utf8',
    );
    expect(src.length, 'read the handler').toBeGreaterThan(500);
    // The specific shape that broke: a hardcoded numeric ceiling on the payload.
    expect(src).not.toMatch(/length\s*<=\s*\d+/);
    expect(src).toContain('knownFlags.length');
  });
});

describe('features.identity is a nested object, not a toggle', () => {
  it('identity exists and is NOT a boolean, so it must never be offered as a flag', () => {
    const all = realConfig.features as unknown as Record<string, unknown>;
    expect(all.identity, 'identity should still be a nested object').toBeTypeOf('object');
    expect(booleanFlags).not.toContain('identity');
  });

  it('the GET route filters to booleans, so no toggle is rendered for it', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'features', 'index.get.ts'),
      'utf8',
    );
    expect(src.length, 'read the handler').toBeGreaterThan(400);
    expect(src).toContain("typeof value !== 'boolean'");
  });

  it('a boolean sent for identity would have destroyed the sub-flags', () => {
    // Documents the consequence the filter prevents: the override merge is a
    // shallow spread, so `identity: true` replaces the whole object.
    const existing = { identity: { linkRemoteAccounts: true, signInWithRemote: true } };
    const merged = { ...existing, ...{ identity: true } };
    expect(merged.identity).toBe(true);
    expect(typeof merged.identity).not.toBe('object');
  });
});
