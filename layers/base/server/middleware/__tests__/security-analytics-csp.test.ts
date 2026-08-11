/**
 * The CSP must open a third-party origin only when that third party is actually
 * switched on.
 *
 * Declaring a provider is not the same as enabling it: the reference app
 * declares one so its e2e can exercise the consent gate while leaving the flag
 * off. The first version of this middleware read only the config block, so
 * commonpub.io went live allowing googletagmanager in script-src while its own
 * privacy page correctly stated it uses no analytics. A CSP and a privacy page
 * disagreeing is the exact failure the shared provider registry exists to stop.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '..', 'security.ts'), 'utf8');

/** Source with comments stripped, so a comment ABOUT a vendor is not mistaken
 *  for a hardcoded vendor host. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('security middleware — analytics CSP', () => {
  it('gates the origin union on features.analytics, not just on the config block', () => {
    expect(source).toMatch(/features\.analytics === true/);
    // The empty fallback is what keeps an instance that measures nothing on the
    // tight default.
    expect(source).toMatch(/\{\s*script:\s*\[\],\s*connect:\s*\[\]\s*\}/);
  });

  it('derives the origins rather than naming a vendor', () => {
    expect(source).toMatch(/analyticsCspOrigins\(/);
    expect(code, 'no vendor host may be hardcoded in a middleware every instance runs')
      .not.toMatch(/googletagmanager|google-analytics/);
  });

  it('appends rather than assigns, so the dev HMR sources survive', () => {
    expect(source).toMatch(/appendCspSources\(cspDirectives, 'script-src'/);
    expect(source).toMatch(/appendCspSources\(cspDirectives, 'connect-src'/);
    // A bare assignment to connect-src after the dev block would drop ws:/wss:.
    expect(source).not.toMatch(/cspDirectives\['connect-src'\]\s*=\s*.*google/);
  });
});
