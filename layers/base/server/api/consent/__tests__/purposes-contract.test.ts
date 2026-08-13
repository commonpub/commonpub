/**
 * Source-contract guards for the two purpose-consent routes.
 *
 * These assert the things a behavioural test cannot see, because they are about
 * what the routes DO NOT do: they do not touch the cookie consent system, they
 * do not widen `consentInputSchema`, they do not write a `sharing:*` row into
 * the live `user_consents` table, and they do not reach past
 * `@commonpub/server` into `@commonpub/persona`. Section 14.4 of the plan makes
 * each of those a deliberate boundary; a test that names it is what stops a
 * later change from crossing it by accident.
 *
 * Every scan below is guarded (P7): a broken path yields zero files, and zero
 * files is how a sweeping test passes green while walking nothing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routeDir = resolve(__dirname, '..');
const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..', '..');

const ROUTES = [
  { name: 'GET /api/consent/purposes', file: 'purposes.get.ts' },
  { name: 'PUT /api/consent/purposes', file: 'purposes.put.ts' },
] as const;

/** A route file with real logic in it. Anything shorter means the path is wrong. */
const MIN_ROUTE_BYTES = 1500;

/**
 * Strip comments so a forbidden-token scan reads CODE only.
 *
 * These routes deliberately NAME the things they must not touch, in their doc
 * comments, because "we do not widen `consentInputSchema`" is the sentence a
 * future reader needs. A naive `src.includes(token)` would then fail on its own
 * documentation, and the obvious fix (deleting the explanation) is the wrong
 * one.
 *
 * String-aware on purpose. A naive `/\*[\s\S]*?\*\//` strip treats a `/*`
 * inside a line comment or a string as the start of a block and swallows
 * everything to the next `*` + `/`, which is how a scanner silently starts
 * reading half a file. There are no regex literals in either route; a `/` in a
 * string is handled, a bare regex literal containing a quote is not, and the
 * positive controls below pin both behaviours.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    const ch = src[i]!;
    if (ch === "'" || ch === '"' || ch === '`') {
      out += ch;
      i += 1;
      while (i < src.length && src[i] !== ch) {
        if (src[i] === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        i += 1;
      }
      out += src[i] ?? '';
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const sources = ROUTES.map((r) => {
  const src = readFileSync(resolve(routeDir, r.file), 'utf8');
  return { ...r, src, code: stripComments(src) };
});

describe('the scan actually walked the routes (P7)', () => {
  it('read both route files and both carry real content', () => {
    expect(sources).toHaveLength(2);
    for (const { file, src, code } of sources) {
      expect(src.length, `${file} is suspiciously small; check the path`).toBeGreaterThan(
        MIN_ROUTE_BYTES,
      );
      expect(src, `${file} must define a handler`).toContain('defineEventHandler');
      // The stripper must remove commentary and keep code. Zero-length output is
      // how a comment-stripping scan passes every "does not contain" assertion.
      expect(code.length, `${file}: nothing survived comment stripping`).toBeGreaterThan(400);
      expect(code.length, `${file}: stripping removed nothing`).toBeLessThan(src.length);
      expect(code).toContain('defineEventHandler');
    }
  });

  it('the comment stripper is right about the cases that break naive ones', () => {
    // A line comment containing `/*` must not open a block comment.
    expect(stripComments("const a = 1; // see /api/*\nconst b = 2;")).toContain('const b = 2;');
    // A block-comment opener inside a string is not a comment.
    expect(stripComments("const a = '/* not a comment */'; const b = 2;")).toContain('const b');
    expect(stripComments("const a = '/* not a comment */';")).toContain('/* not a comment */');
    // A `//` inside a string is not a line comment.
    expect(stripComments("const u = 'https://example.test'; const b = 2;")).toContain('const b');
    // Real comments do go.
    expect(stripComments('/* gone */ const a = 1;')).not.toContain('gone');
    expect(stripComments('const a = 1; // gone')).not.toContain('gone');
    // An escaped quote does not end the string.
    expect(stripComments("const a = 'it\\'s // fine'; const b = 2;")).toContain('const b');
  });
});

describe.each(sources)('$name — the gate', ({ name, src }) => {
  it('requires the dataSharingConsents flag, which throws 404 rather than 403', () => {
    expect(src).toMatch(/requireFeature\(\s*'dataSharingConsents'\s*\)/);
  });

  it('requires a logged-in user', () => {
    expect(src).toMatch(/requireAuth\(\s*event\s*\)/);
  });

  it('checks the flag BEFORE the session on the READ, so a probe learns nothing', () => {
    // The PUT is exempt and that is the point of the next assertion: it has to
    // read the DIRECTION out of the body before it can know whether the gate
    // applies at all. It still calls `requireAuth` first, so an anonymous probe
    // gets a 401 there and never reaches the flag check either way.
    if (name.startsWith('PUT')) {
      const authAt = src.indexOf('requireAuth(event)');
      const flagAt = src.indexOf("requireFeature('dataSharingConsents')");
      expect(authAt).toBeGreaterThan(-1);
      expect(flagAt).toBeGreaterThan(authAt);
      return;
    }
    const flagAt = src.indexOf("requireFeature('dataSharingConsents')");
    const authAt = src.indexOf('requireAuth(event)');
    expect(flagAt).toBeGreaterThan(-1);
    expect(authAt).toBeGreaterThan(-1);
    expect(flagAt).toBeLessThan(authAt);
  });

  it('gates the GRANT direction only, so a withdrawal survives the flag', () => {
    // Art. 7(3): withdrawal must be as easy as giving. `recordPurposeConsent`
    // already refuses to gate a withdrawal on offerability; gating the whole
    // ROUTE on the flag undid that one layer up, so an operator switching the
    // disclosing surface off to revise copy trapped every existing grant.
    if (!name.startsWith('PUT')) return;
    expect(src).toMatch(/if\s*\(\s*body\.grant\s*\)\s*requireFeature\(\s*'dataSharingConsents'\s*\)/);
  });

  it('gates on dataSharingConsents ONLY, never on a second undeclared flag', () => {
    const flags = [...src.matchAll(/requireFeature\(\s*'([a-zA-Z]+)'\s*\)/g)].map((m) => m[1]);
    expect(flags.length).toBeGreaterThan(0);
    expect(new Set(flags)).toEqual(new Set(['dataSharingConsents']));
  });
});

describe.each(sources)('$name — section 14.4 boundaries', ({ file, code }) => {
  // Each entry names the thing the plan says this feature must not touch, and
  // why. Deleting one of these deletes the reason it exists.
  const forbidden: Array<{ token: string; why: string }> = [
    {
      token: 'consentInputSchema',
      why: 'plan 6.4: the two-value cookie/terms enum is NOT widened for sharing kinds',
    },
    {
      token: 'useCookieConsent',
      why: 'plan 6.1: this feature introduces zero new cookies and never moves the cookie digest',
    },
    {
      token: 'recordConsent',
      why: 'plan 6.4: that service dedups on version alone, so a withdrawal is not representable',
    },
    {
      token: 'userConsents',
      why: 'section 14.4: no sharing:* row is written into the live GDPR table',
    },
    {
      token: 'user_consents',
      why: 'section 14.4: the live GDPR table is neither read nor widened here',
    },
    {
      token: 'consent_proofs',
      why: 'section 14.5: there is no erasure-surviving proof in v1',
    },
    {
      token: 'metrics_daily',
      why: 'section 14.4: persona owns its own rollup table',
    },
  ];

  // Scanned over CODE, not prose: the doc comments name several of these
  // deliberately, to record that they are not touched and why.
  it.each(forbidden)(`${file} never uses $token in code`, ({ token, why }) => {
    expect(code, why).not.toContain(token);
  });

  it('imports @commonpub/persona nowhere: these two routes talk to @commonpub/server', () => {
    // Scoped to THESE routes, not to the layer. `@commonpub/layer` does declare
    // `@commonpub/persona` (plan 14.3 lists `layers/base/**` among its
    // importers, and a `.vue` component cannot reach the registry through the
    // Node-only server package). What these two files must not do is take a
    // SECOND import edge for values `@commonpub/server` already re-exports:
    // every purpose string on a consent card then has one source, and a card
    // cannot disagree with the snapshot `recordPurposeConsent` stores as
    // evidence of what was shown.
    expect(code).not.toMatch(/from\s*'@commonpub\/persona'/);
    expect(code).not.toMatch(/import\(\s*'@commonpub\/persona'\s*\)/);
  });

  it('reaches into no package by relative path', () => {
    // A route may import a sibling route or a layer util; it may never climb out
    // of the layer into `packages/`.
    expect(code).not.toMatch(/from\s*'[./]*\.\.[/]packages[/]/);
  });
});

describe('PUT — the body contract, in source', () => {
  const src = sources[1]!.src;

  it('accepts exactly three keys and is .strict()', () => {
    expect(src).toContain('.strict()');
    const schema = src.slice(
      src.indexOf('const purposeConsentInputSchema'),
      src.indexOf('.strict();'),
    );
    expect(schema.length).toBeGreaterThan(0);
    const keys = [...schema.matchAll(/^\s{4}([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['grant', 'purpose', 'scopeDigest']);
  });

  it('takes ONE purpose per request: no array, no bulk key', () => {
    // A bulk endpoint invites an "enable all" affordance, and there will not be
    // one. `z.array` anywhere in the input schema is that affordance arriving.
    const schema = src.slice(
      src.indexOf('const purposeConsentInputSchema'),
      src.indexOf('.strict();'),
    );
    expect(schema).not.toContain('z.array');
    expect(schema).not.toMatch(/purposes\s*:/);
  });

  it('the SERVER supplies the policy version, the snapshot, the IP and the user agent', () => {
    // The write call must name these itself. If any of them came off `body`,
    // the record of what was disclosed would be whatever the client claimed.
    expect(src).toMatch(/source:\s*'settings'/);
    expect(src).toMatch(/getRequestIP\(\s*event\s*\)/);
    expect(src).toMatch(/getRequestHeader\(\s*event\s*,\s*'user-agent'\s*\)/);
    expect(src).not.toMatch(/body\.(policyVersion|scopeSnapshot|state|source|ip|userAgent)/);
  });

  it('never auto-retries and never auto-applies a pending grant on 409', () => {
    expect(src).toMatch(/retryable:\s*false/);
    // The handler must call the writer exactly once. A second call site is how a
    // "just retry against the new digest" convenience gets added, which would
    // record consent against a disclosure the user has not read.
    const code = sources[1]!.code;
    expect(code.match(/recordPurposeConsent\(/g) ?? []).toHaveLength(1);
    // And the scope-changed branch itself throws.
    const branch = code.slice(code.indexOf('err instanceof PurposeScopeChangedError'));
    expect(branch.length).toBeGreaterThan(0);
    expect(branch).toContain('statusCode: 409');
    expect(branch).not.toContain('recordPurposeConsent(');
  });

  it('the 409 body carries the new purpose list AND the diff (plan 6.6)', () => {
    expect(src).toMatch(/code:\s*'SCOPE_CHANGED'/);
    expect(src).toContain('diff:');
    expect(src).toContain('purposes:');
    expect(src).toContain('expectedScopeDigest');
    expect(src).toContain('receivedScopeDigest');
  });
});

describe('user-facing copy', () => {
  it('no em dash and no exclamation mark in any statusMessage', () => {
    const messages = sources.flatMap(({ src }) =>
      [...src.matchAll(/statusMessage:\s*(?:'([^']*)'|`([^`]*)`)/g)].map((m) => m[1] ?? m[2] ?? ''),
    );
    // Guard: if the extractor stops matching, this test must not pass on zero.
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message, 'no em dash in user-facing copy').not.toContain('—');
      expect(message, 'no exclamation mark in a consent surface').not.toContain('!');
    }
  });
});

/**
 * The registry these two routes read, and where they read it from.
 *
 * `revocationEffect`, `legalBasis` and `answersAfterRevocation` live only in
 * `PROCESSING_PURPOSE_SPECS` in `@commonpub/persona`, and plan 6.6 requires all
 * three on every card. These routes take them from `@commonpub/server`, which
 * re-exports the registry name-for-name, so the whole route surface has one
 * dependency edge and the re-export has exactly one definition behind it.
 *
 * The layer package DOES declare `@commonpub/persona` (plan 14.3), because the
 * components and pages import the registry directly and cannot go through a
 * Node-only package. That is asserted below rather than assumed: an import that
 * resolves only through an undeclared symlink survives locally and breaks on a
 * clean `pnpm install --frozen-lockfile`.
 */
describe('@commonpub/server must re-export the purpose registry', () => {
  const serverFiles = [
    'packages/server/src/index.ts',
    'packages/server/src/persona/index.ts',
  ].map((rel) => ({ rel, src: readFileSync(resolve(repoRoot, rel), 'utf8') }));

  it('read both server barrels (P7)', () => {
    expect(serverFiles).toHaveLength(2);
    for (const { rel, src } of serverFiles) {
      expect(src.length, `${rel} is empty; check the path`).toBeGreaterThan(200);
    }
  });

  it('exports PROCESSING_PURPOSE_SPECS from @commonpub/persona', () => {
    const exported = serverFiles.some(({ src }) =>
      /export\s*\{[^}]*PROCESSING_PURPOSE_SPECS[^}]*\}\s*from\s*'@commonpub\/persona'/s.test(src),
    );
    expect(
      exported,
      'Add to packages/server/src/persona/index.ts (or src/index.ts):\n'
      + "  export { PROCESSING_PURPOSES, PROCESSING_PURPOSE_SPECS } from '@commonpub/persona';\n"
      + 'layers/base/server/api/consent/purposes.get.ts reads revocationEffect, legalBasis and\n'
      + 'answersAfterRevocation from it, and these routes take their whole dependency\n'
      + 'surface from @commonpub/server.',
    ).toBe(true);
  });

  it('the layer declares @commonpub/persona, so the components can import it', () => {
    // `layers/base/components/persona/*.vue` and `pages/admin/persona.vue`
    // import the registry directly; a Vue component cannot reach it through
    // `@commonpub/server`, which is Node-only. An undeclared dependency
    // resolves through a leftover symlink on a developer machine and dies on a
    // fresh `pnpm install --frozen-lockfile`, so the declaration is the thing
    // worth pinning.
    const pkg = readFileSync(resolve(repoRoot, 'layers/base/package.json'), 'utf8');
    expect(pkg.length).toBeGreaterThan(200);
    expect(pkg).toMatch(/"@commonpub\/persona":\s*"workspace:\*"/);
  });
});
