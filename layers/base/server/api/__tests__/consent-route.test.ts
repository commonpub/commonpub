/**
 * Static contract tests for the GDPR consent routes (Phase 2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiDir = resolve(__dirname, '..');
const post = readFileSync(resolve(apiDir, 'consent.post.ts'), 'utf8');
const status = readFileSync(resolve(apiDir, 'consent', 'status.get.ts'), 'utf8');

describe('consent routes — contract', () => {
  it('both require a logged-in user', () => {
    expect(post).toMatch(/requireAuth\(\s*event\s*\)/);
    expect(status).toMatch(/requireAuth\(\s*event\s*\)/);
  });

  it('POST validates the kind and uses a SERVER-supplied version (not the body)', () => {
    expect(post).toMatch(/parseBody\(\s*event\s*,\s*consentInputSchema\s*\)/);
    expect(post).toMatch(/config\.instance\.termsVersion/);
    expect(post).toMatch(/config\.instance\.cookiePolicyVersion/);
    expect(post).toMatch(/recordConsent\(/);
  });

  it('status reads the flag + computes via needsTermsReacceptance', () => {
    expect(status).toMatch(/requireTermsAcceptance/);
    expect(status).toMatch(/needsTermsReacceptance\(/);
  });
});
