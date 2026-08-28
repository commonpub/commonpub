/**
 * Guards every XML-emitting route in the layer.
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
 * WHY THIS FILE DISCOVERS ITS TARGETS INSTEAD OF LISTING THEM.
 * The first version of this guard hand-listed `sitemap.xml.ts` and
 * `feed.xml.ts`, because those were the two copies the audit had found. There
 * were FIVE: the per-user feed, the per-hub feed and the federated-hub feed each
 * carried their own `escapeXml`, none of which stripped control characters, and
 * a guard that pins two of five certifies the drift is closed while three copies
 * still carry the bug. So the scan below finds every definition under
 * `layers/base/server/` and asserts on all of them — a sixth copy added tomorrow
 * fails this test instead of hiding behind it.
 *
 * Source-level: these are Nitro route handlers whose bodies need a live DB and
 * runtime config, and the assertions are about the query predicate and the
 * escaping table, both visible in the source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SERVER_ROOT = resolve(__dirname, '..', '..');

/** Every non-test .ts under layers/base/server/. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

const ESCAPE_XML_BODY = /function escapeXml\(str: string\): string \{[\s\S]*?\n\}/;

/** Every file under server/ that defines its own escapeXml, with that body. */
const copies = walk(SERVER_ROOT)
  .map((file) => ({ file, src: readFileSync(file, 'utf8') }))
  .filter(({ src }) => ESCAPE_XML_BODY.test(src))
  .map(({ file, src }) => ({
    file: file.slice(SERVER_ROOT.length + 1),
    body: src.match(ESCAPE_XML_BODY)![0],
    src,
  }));

const sitemap = readFileSync(resolve(SERVER_ROOT, 'routes', 'sitemap.xml.ts'), 'utf8');

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

describe('XML escaping — every copy, not a hand-picked subset', () => {
  // The five known as of the session-256 follow-up. Listed so that a route being
  // DELETED is as loud as one being added: if this shrinks, something moved and
  // the reader should find out from a failing test rather than from a broken feed.
  const KNOWN = [
    'api/federated-hubs/[id]/feed.xml.get.ts',
    'api/hubs/[slug]/feed.xml.get.ts',
    'api/users/[username]/feed.xml.get.ts',
    'routes/feed.xml.ts',
    'routes/sitemap.xml.ts',
  ];

  it('found exactly the copies it knows about', () => {
    expect(copies.map((c) => c.file).sort()).toEqual(KNOWN);
  });

  it.each(copies.map((c) => c.file))('%s strips XML-illegal control characters', (file) => {
    const copy = copies.find((c) => c.file === file)!;
    expect(copy.body).toContain("replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g, '')");
  });

  it.each(copies.map((c) => c.file))('%s still escapes the five XML entities', (file) => {
    const copy = copies.find((c) => c.file === file)!;
    for (const ent of ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']) {
      expect(copy.body).toContain(ent);
    }
  });

  it('keeps every implementation byte-identical, so they cannot drift', () => {
    const distinct = new Set(copies.map((c) => c.body));
    expect(
      [...distinct],
      `expected one shared implementation, found ${distinct.size} across ${copies.map((c) => c.file).join(', ')}`,
    ).toHaveLength(1);
  });
});

describe('the escaping actually removes what XML forbids', () => {
  // Behavioural, not textual: run the real body and check the output. XML 1.0's
  // Char production is #x9 | #xA | #xD | #x20-#xD7FF | ... — everything else in
  // C0 is illegal, and there is no numeric reference that makes it legal.
  // The body is TypeScript source read off disk; drop the one type annotation it
  // carries so it can be evaluated as plain JS. Deliberately narrow — if the
  // signature ever changes shape this throws rather than silently testing nothing.
  const js = copies[0]!.body.replace('function escapeXml(str: string): string {', 'function escapeXml(str) {');
  expect(js).not.toContain(': string');
  const escapeXml = new Function(`${js}\nreturn escapeXml;`)() as (s: string) => string;

  const ILLEGAL = [0x00, 0x01, 0x08, 0x0b, 0x0c, 0x0e, 0x1f];
  const LEGAL = [0x09, 0x0a, 0x0d, 0x20];

  it.each(ILLEGAL)('strips U+%s', (code) => {
    const out = escapeXml(`a${String.fromCharCode(code)}b`);
    expect(out).toBe('ab');
  });

  it.each(LEGAL)('keeps the whitespace XML does permit, U+%s', (code) => {
    const ch = String.fromCharCode(code);
    expect(escapeXml(`a${ch}b`)).toBe(`a${ch}b`);
  });

  it('still escapes entities after stripping', () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
  });
});

// Positive control: a rename or move would otherwise make every matcher above
// vacuous by testing an empty string, or make the scan return nothing and pass
// every `it.each` by iterating zero cases.
describe('the guard read what it claims to', () => {
  it('walked the server tree and found real files', () => {
    expect(walk(SERVER_ROOT).length).toBeGreaterThan(100);
  });

  it('found five escapeXml copies, not zero', () => {
    expect(copies).toHaveLength(5);
    for (const c of copies) expect(c.body.length).toBeGreaterThan(100);
  });

  it('read the sitemap route', () => {
    expect(sitemap).toContain('.from(users)');
    expect(sitemap.length).toBeGreaterThan(1000);
  });
});
