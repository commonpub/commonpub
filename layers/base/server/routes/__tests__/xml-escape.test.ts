/**
 * Guards the two XML output routes: sitemap.xml and feed.xml.
 *
 * Two separate concerns, both of which shipped:
 *
 * 1. PRIVACY. `users.profileVisibility` is a real setting
 *    ('public' | 'members' | 'private'), and the sitemap filtered on `status`
 *    alone, so a member who set their profile to members-only or private still
 *    had their profile URL published to crawlers. The public API already gated
 *    on the right predicate in two places; the sitemap was the copy that
 *    drifted, which is why a predicate like this wants a test pinning every
 *    user of it.
 *
 * 2. VALIDITY. XML 1.0 permits only #x9, #xA, #xD and #x20 upward. A C0 control
 *    character is illegal even written as a numeric reference, so one stray
 *    control character in a title makes the whole document malformed and
 *    readers reject the entire feed rather than skipping that item.
 *
 * Source-level: these are Nitro route handlers whose bodies need a live DB and
 * runtime config, and the assertions are about the query predicate and the
 * escaping table, both visible in the source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f: string): string => readFileSync(resolve(__dirname, '..', f), 'utf8');
const sitemap = read('sitemap.xml.ts');
const feed = read('feed.xml.ts');

describe('sitemap user enumeration respects profile visibility', () => {
  it('filters on profileVisibility, not status alone', () => {
    expect(sitemap).toMatch(/eq\(users\.profileVisibility, 'public'\)/);
  });

  it('also excludes soft-deleted users, matching the public API predicate', () => {
    expect(sitemap).toMatch(/isNull\(users\.deletedAt\)/);
  });

  it('still restricts to active users', () => {
    expect(sitemap).toMatch(/eq\(users\.status, 'active'\)/);
  });

  it('has no bare status-only user query left behind', () => {
    expect(sitemap).not.toMatch(/\.from\(users\)\s*\.where\(eq\(users\.status, 'active'\)\)/);
  });
});

describe('XML escaping', () => {
  const CONTROL_STRIP = /\.replace\(\/\[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\]\/g, ''\)/;

  for (const [name, src] of [['sitemap.xml', sitemap], ['feed.xml', feed]] as const) {
    it(`${name} strips XML-illegal control characters`, () => {
      expect(src).toMatch(CONTROL_STRIP);
    });

    it(`${name} still escapes the five XML entities`, () => {
      for (const ent of ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']) {
        expect(src).toContain(ent);
      }
    });
  }

  it('keeps the two implementations byte-identical, so they cannot drift', () => {
    const pick = (s: string): string | undefined =>
      s.match(/function escapeXml\(str: string\): string \{[\s\S]*?\n\}/)?.[0];
    expect(pick(sitemap)).toBeDefined();
    expect(pick(sitemap)).toBe(pick(feed));
  });
});

// Positive control: a rename or move would otherwise make every matcher above
// vacuous by testing an empty string.
describe('the guard read what it claims to', () => {
  it('read both routes', () => {
    expect(sitemap).toContain('.from(users)');
    expect(feed).toContain('escapeXml');
    expect(sitemap.length).toBeGreaterThan(1000);
    expect(feed.length).toBeGreaterThan(500);
  });
});
