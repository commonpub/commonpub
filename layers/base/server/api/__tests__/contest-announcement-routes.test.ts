/**
 * Contract tests for the five contest-announcement routes (session 259).
 * Source-string reads, matching contest-email-preview-route.test.ts, since no
 * full nitro harness is wired for these handlers. They lock in the gates that
 * stand between an organizer and every participant's inbox.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '..', 'contests', '[slug]', 'announcements');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const read = (f: string): string => readFileSync(resolve(DIR, f), 'utf8');
const ROUTES = Object.fromEntries(FILES.map((f) => [f, read(f)])) as Record<string, string>;

// A scanning test has to prove it actually scanned something, or it passes
// vacuously the day a file is renamed and the sweep finds nothing.
describe('the announcement route set', () => {
  it('covers all five routes', () => {
    expect(FILES.sort()).toEqual(
      ['index.get.ts', 'index.post.ts', 'preview.post.ts', 'recipients.post.ts', 'test.post.ts'].sort(),
    );
  });
});

describe.each(Object.entries(ROUTES))('%s', (_name, src) => {
  it('is gated by the contests AND contestBroadcast feature flags', () => {
    expect(src).toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
    expect(src).toMatch(/requireFeature\(\s*['"]contestBroadcast['"]\s*\)/);
  });

  it('requires auth and an organizer-only check, rejecting anyone else with 403', () => {
    expect(src).toMatch(/requireAuth\(\s*event\s*\)/);
    expect(src).toMatch(/ownerOrPermission\(/);
    expect(src).toMatch(/isContestEditor\(/);
    expect(src).toMatch(/statusCode:\s*403/);
  });

  it('404s an unknown contest before doing any work', () => {
    expect(src).toMatch(/statusCode:\s*404/);
  });

  it('validates every request body with a schema (never a raw readBody)', () => {
    if (!/\.post\.ts$/.test(_name)) return;
    expect(src).toMatch(/parseBody\(\s*event\s*,\s*contestAnnouncement\w*Schema\s*\)/);
    expect(src).not.toMatch(/readBody\(/);
  });
});

describe('the send route', () => {
  const src = ROUTES['index.post.ts']!;

  // Without emailNotifications the outbox worker never drains, so enqueueing
  // produces a queue nobody delivers and a UI that claims success.
  it('refuses when email delivery is off rather than queueing into a void', () => {
    expect(src).toMatch(/features\.emailNotifications/);
    expect(src).toMatch(/statusCode:\s*409/);
  });

  // The bound is enforced INSIDE sendContestAnnouncement, after its idempotency
  // short-circuit, so a client retrying an already-sent announcement gets its
  // result back rather than a 429 for work it is not repeating. The route only
  // supplies the numbers and maps the error.
  it('bounds how many announcements one contest can send in a window', () => {
    expect(src).toMatch(/maxPerWindow:\s*MAX_SENDS_PER_WINDOW/);
    expect(src).toMatch(/windowMs:\s*RATE_WINDOW_MS/);
    expect(src).toMatch(/AnnouncementRateLimitError/);
    expect(src).toMatch(/statusCode:\s*429/);
  });

  it('passes the client idempotency key through, so a double-click cannot double-send', () => {
    expect(src).toMatch(/idempotencyKey:\s*input\.idempotencyKey/);
  });

  it('signs per-recipient unsubscribe tokens with the real AUTH_SECRET', () => {
    expect(src).toMatch(/rc\.authSecret/);
  });
});

describe('the recipients route', () => {
  const src = ROUTES['recipients.post.ts']!;

  // Addresses must never travel back to the organizer: the count endpoint is the
  // one place the audience is exposed at all, and it exposes only a number.
  it('returns a count and never the recipients themselves', () => {
    expect(src).toMatch(/countAnnouncementRecipients\(/);
    expect(src).not.toMatch(/resolveAnnouncementRecipients\(/);
    expect(src).toMatch(/Promise<\{\s*count:\s*number\s*\}>/);
  });
});

describe('preview and test renders', () => {
  it.each(['preview.post.ts', 'test.post.ts'])(
    '%s renders through renderEmailBlocks with an absolute siteUrl',
    (name) => {
      const src = ROUTES[name]!;
      expect(src).toMatch(/renderEmailBlocks\(/);
      expect(src).toMatch(/siteUrl:\s*origin/);
      // A blank registration block must target THIS contest, not account signup.
      expect(src).toMatch(/registrationUrl:\s*`\$\{contestUrl\}\/register`/);
      expect(src).toMatch(/emailTemplates\.contestAnnouncement/);
    },
  );

  it('the test send marks the subject so it cannot be mistaken for the real thing', () => {
    expect(ROUTES['test.post.ts']!).toMatch(/\[TEST\]/);
  });

  it('the test send resolves a chosen user address server-side, never from the client', () => {
    const src = ROUTES['test.post.ts']!;
    expect(src).toMatch(/toUserId/);
    expect(src).toMatch(/\.from\(users\)/);
  });
});
