/**
 * Static contract tests for the contest registration routes:
 *   GET/POST/DELETE /api/contests/:slug/register
 *
 * Source-string reads (same pattern as entries-score-gating.test.ts / the
 * unsubscribe-route test) since a full PGlite + nitro + better-auth harness for
 * these handlers isn't wired. They lock the wiring invariants: feature-gated on
 * `contests`, mutating routes require auth, an unknown/unviewable slug 404s (never
 * leaks existence), and each route returns the registrant count.
 *
 * The registration LOGIC itself (idempotency, email-enqueue gating, count) is
 * unit-tested for real in packages/server contest-registrations.integration.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '..', '[slug]');
const read = (f: string): string => readFileSync(resolve(dir, f), 'utf8');

const get = read('register.get.ts');
const post = read('register.post.ts');
const del = read('register.delete.ts');

describe('contest registration routes — shared contract', () => {
  it('every method is feature-gated behind the contests flag', () => {
    for (const [name, src] of [['GET', get], ['POST', post], ['DELETE', del]] as const) {
      expect(src, `${name} must call requireFeature('contests')`).toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
    }
  });

  it('every method resolves the contest by slug and 404s an unknown one', () => {
    for (const [name, src] of [['GET', get], ['POST', post], ['DELETE', del]] as const) {
      expect(src, `${name} must resolve via getContestBySlug`).toMatch(/getContestBySlug\(/);
      expect(src, `${name} must 404 an unknown slug`).toMatch(/statusCode:\s*404/);
    }
  });

  it('every method returns the registrant count', () => {
    for (const [name, src] of [['GET', get], ['POST', post], ['DELETE', del]] as const) {
      expect(src, `${name} must compute the count via getRegistrantCount`).toMatch(/getRegistrantCount\(/);
    }
  });
});

describe('GET /api/contests/:slug/register', () => {
  it('reads the viewer non-throwingly (anonymous callers allowed)', () => {
    expect(get).toMatch(/getOptionalUser\(\s*event\s*\)/);
    expect(get, 'must NOT requireAuth on the read path').not.toMatch(/requireAuth\(/);
  });

  it('gates a non-public contest through canViewContest (404, not 403)', () => {
    expect(get).toMatch(/canViewContest\(/);
  });

  it('resolves the viewer registration (tier + fields) via getViewerRegistration', () => {
    expect(get).toMatch(/getViewerRegistration\(/);
  });
});

describe('POST /api/contests/:slug/register', () => {
  it('requires auth', () => {
    expect(post).toMatch(/requireAuth\(\s*event\s*\)/);
  });

  it('gates a non-public contest through canViewContest', () => {
    expect(post).toMatch(/canViewContest\(/);
  });

  it('delegates to registerForContest with an email context', () => {
    expect(post).toMatch(/registerForContest\(/);
    expect(post, 'must build the per-instance email context (siteUrl/siteName/secret)').toMatch(/siteUrl/);
    expect(post).toMatch(/siteName/);
    expect(post).toMatch(/secret/);
  });

  it('400s when registration is not open (neither registered nor already)', () => {
    expect(post).toMatch(/statusCode:\s*400/);
  });
});

describe('DELETE /api/contests/:slug/register', () => {
  it('requires auth', () => {
    expect(del).toMatch(/requireAuth\(\s*event\s*\)/);
  });

  it('delegates to unregisterForContest', () => {
    expect(del).toMatch(/unregisterForContest\(/);
  });
});
