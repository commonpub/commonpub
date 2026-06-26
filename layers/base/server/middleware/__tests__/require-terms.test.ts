/**
 * Static contract test for the terms re-acceptance enforcement middleware
 * (GDPR Phase 2). Source-string read (the middleware needs the full nitro + auth
 * + config stack to run; the decision logic itself is unit-tested via
 * needsTermsReacceptance in the server package).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '..', 'require-terms.ts'), 'utf8');

describe('require-terms middleware — contract', () => {
  it('only acts on unsafe-method /api writes', () => {
    expect(src).toMatch(/POST.*PUT.*PATCH.*DELETE/s);
    expect(src).toMatch(/startsWith\(\s*['"]\/api\/['"]\s*\)/);
  });

  it('is gated by the requireTermsAcceptance flag (no-op when off)', () => {
    expect(src).toMatch(/config\.features\.requireTermsAcceptance\s*!==\s*true/);
  });

  it('exempts the routes needed to clear the block (consent + auth)', () => {
    expect(src).toMatch(/\/api\/auth\//);
    expect(src).toMatch(/\/api\/consent/);
  });

  it('403s a stale-consent logged-in user via needsTermsReacceptance', () => {
    expect(src).toMatch(/getOptionalUser\(\s*event\s*\)/);
    expect(src).toMatch(/needsTermsReacceptance\(/);
    expect(src).toMatch(/statusCode:\s*403/);
  });
});
