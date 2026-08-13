import { describe, it, expect } from 'vitest';
import { PUBLIC_API_SCOPES } from '@commonpub/schema';
import type { PublicApiScope } from '@commonpub/schema';
import { hasScope, WILDCARD_PROTECTED_SCOPES, filterKnownScopes } from '../scopes.js';

// Plan 7.5: `read:audience` ships with wildcard protection in the SAME change as
// the PUBLIC_API_SCOPES tuple edit. The tuple edit alone is the regression, so
// these tests exist mainly to fail if the protection is ever removed while the
// scope stays.

describe('WILDCARD_PROTECTED_SCOPES', () => {
  it('contains read:audience', () => {
    expect(WILDCARD_PROTECTED_SCOPES.has('read:audience')).toBe(true);
  });

  it('every protected scope is a real scope in the tuple', () => {
    expect(WILDCARD_PROTECTED_SCOPES.size).toBeGreaterThanOrEqual(1);
    for (const s of WILDCARD_PROTECTED_SCOPES) {
      expect(PUBLIC_API_SCOPES as readonly string[]).toContain(s);
    }
  });

  it('does not protect the wildcard itself (that would break every read: check)', () => {
    expect(WILDCARD_PROTECTED_SCOPES.has('read:*')).toBe(false);
  });
});

// Directory plan section 4: `read:members` ships with wildcard protection in the
// SAME change as its PUBLIC_API_SCOPES tuple entry, for a stronger reason than
// `read:audience` had. It is the only scope that returns identified individuals,
// and every row it returns writes a `disclosure_events` row naming the recipient
// who saw it. A `read:*` key has no recipient binding, so a disclosure made
// under one would be unattributable and the member's "who has looked at you"
// list would silently omit it.

describe('WILDCARD_PROTECTED_SCOPES — read:members', () => {
  it('contains read:members', () => {
    expect(WILDCARD_PROTECTED_SCOPES.has('read:members')).toBe(true);
  });

  it('read:members is a real scope in the tuple', () => {
    expect(PUBLIC_API_SCOPES as readonly string[]).toContain('read:members');
  });

  it('protects BOTH persona leaves, so neither can be dropped unnoticed', () => {
    // Named individually rather than asserting a size, so removing one and
    // adding an unrelated third still fails.
    for (const scope of ['read:audience', 'read:members'] as const) {
      expect(WILDCARD_PROTECTED_SCOPES.has(scope)).toBe(true);
    }
  });
});

describe('hasScope — read:members', () => {
  it('read:* does NOT satisfy read:members', () => {
    expect(hasScope(['read:*'], 'read:members')).toBe(false);
  });

  it('an EXPLICIT read:members grant passes', () => {
    expect(hasScope(['read:members'], 'read:members')).toBe(true);
    expect(hasScope(['read:*', 'read:members'], 'read:members')).toBe(true);
  });

  it('read:users does not satisfy read:members', () => {
    // The consent-gated sibling of `/users` is not the same surface: one lists
    // every public member, the other lists the ones who opted in and logs it.
    expect(hasScope(['read:users'], 'read:members')).toBe(false);
  });

  it('read:audience does not satisfy read:members, and vice versa', () => {
    // Aggregates and individuals are different disclosures (directory plan D1).
    expect(hasScope(['read:audience'], 'read:members')).toBe(false);
    expect(hasScope(['read:members'], 'read:audience')).toBe(false);
  });

  it('holding read:members still leaves the wildcard working for unprotected leaves', () => {
    expect(hasScope(['read:*', 'read:members'], 'read:content')).toBe(true);
  });
});

describe('hasScope — granted paths', () => {
  it('exact match passes', () => {
    expect(hasScope(['read:content'], 'read:content')).toBe(true);
  });

  it('read:* passes an unprotected read scope', () => {
    expect(hasScope(['read:*'], 'read:content')).toBe(true);
    expect(hasScope(['read:*'], 'read:analytics')).toBe(true);
  });

  it('an EXPLICIT read:audience grant passes, wildcard protection notwithstanding', () => {
    // The exact-match branch runs before the protection branch. Protecting the
    // leaf must narrow the wildcard, not make the scope unusable.
    expect(hasScope(['read:audience'], 'read:audience')).toBe(true);
    expect(hasScope(['read:content', 'read:audience'], 'read:audience')).toBe(true);
  });

  it('read:* alongside an explicit read:audience still passes both', () => {
    expect(hasScope(['read:*', 'read:audience'], 'read:audience')).toBe(true);
    expect(hasScope(['read:*', 'read:audience'], 'read:hubs')).toBe(true);
  });
});

describe('hasScope — refused paths', () => {
  it('read:* does NOT satisfy read:audience', () => {
    expect(hasScope(['read:*'], 'read:audience')).toBe(false);
  });

  it('every wildcard-protected scope is refused to a read:* holder', () => {
    for (const s of WILDCARD_PROTECTED_SCOPES) {
      expect(hasScope(['read:*'], s)).toBe(false);
    }
  });

  it('a different scope does not satisfy read:audience', () => {
    expect(hasScope(['read:analytics'], 'read:audience')).toBe(false);
    expect(hasScope(['read:users'], 'read:audience')).toBe(false);
  });

  it('an empty grant set refuses everything', () => {
    expect(hasScope([], 'read:content')).toBe(false);
    expect(hasScope([], 'read:audience')).toBe(false);
  });

  it('a mismatched scope is refused', () => {
    expect(hasScope(['read:hubs'], 'read:content')).toBe(false);
  });

  it('read:* is still refused for a non-read scope shape', () => {
    // No write scopes exist today; the branch is guarded on the `read:` prefix,
    // so assert the guard rather than assuming the tuple stays read-only.
    const nonRead = (PUBLIC_API_SCOPES as readonly string[]).filter(
      (s) => !s.startsWith('read:'),
    );
    for (const s of nonRead) {
      expect(hasScope(['read:*'], s as PublicApiScope)).toBe(false);
    }
  });
});

describe('filterKnownScopes', () => {
  it('keeps known scopes and drops leftovers', () => {
    expect(
      filterKnownScopes(['read:content', 'read:nonsense', 'read:audience'], PUBLIC_API_SCOPES),
    ).toEqual(['read:content', 'read:audience']);
  });
});
