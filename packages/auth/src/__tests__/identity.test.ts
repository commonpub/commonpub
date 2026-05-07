import { describe, it, expect } from 'vitest';
import {
  SCOPE_VALUES,
  SOFTWARE_KIND_VALUES,
  isScope,
  isSoftwareKind,
  makeHandle,
  parseHandle,
  hasAllScopes,
  coerceScopes,
  isUsableLinkedIdentity,
  type Identity,
  type LinkedIdentity,
  type NativeIdentity,
} from '../identity.js';

const NATIVE: NativeIdentity = {
  kind: 'native',
  id: 'u1',
  userId: 'u1',
  username: 'moheeb',
  instance: 'deveco.io',
  actorUri: 'https://deveco.io/users/moheeb',
  handle: '@moheeb@deveco.io',
};

function makeLinked(overrides: Partial<LinkedIdentity> = {}): LinkedIdentity {
  return {
    kind: 'linked',
    id: 'fa1',
    userId: 'u1',
    username: 'moheeb',
    instance: 'commonpub.io',
    actorUri: 'https://commonpub.io/users/moheeb',
    handle: '@moheeb@commonpub.io',
    scopes: ['read', 'write'],
    softwareKind: 'cpub',
    revokedAt: null,
    ...overrides,
  };
}

describe('SCOPE_VALUES / isScope', () => {
  it('contains the documented vocabulary', () => {
    expect(new Set(SCOPE_VALUES)).toEqual(new Set(['read', 'write', 'follow', 'publish', 'interact']));
  });

  it('isScope is a precise type guard', () => {
    expect(isScope('read')).toBe(true);
    expect(isScope('publish')).toBe(true);
    expect(isScope('admin')).toBe(false);
    expect(isScope('')).toBe(false);
    expect(isScope('READ')).toBe(false); // case-sensitive
  });
});

describe('SOFTWARE_KIND_VALUES / isSoftwareKind', () => {
  it('contains expected entries', () => {
    expect(SOFTWARE_KIND_VALUES).toContain('mastodon');
    expect(SOFTWARE_KIND_VALUES).toContain('cpub');
    expect(SOFTWARE_KIND_VALUES).toContain('unknown');
  });

  it('isSoftwareKind rejects unknown', () => {
    expect(isSoftwareKind('mastodon')).toBe(true);
    expect(isSoftwareKind('twitter')).toBe(false);
  });
});

describe('makeHandle', () => {
  it('builds the @user@host shape', () => {
    expect(makeHandle('moheeb', 'deveco.io')).toBe('@moheeb@deveco.io');
  });

  it('strips a single leading @ from username', () => {
    expect(makeHandle('@moheeb', 'deveco.io')).toBe('@moheeb@deveco.io');
  });

  it('preserves casing of the username', () => {
    expect(makeHandle('Moheeb', 'deveco.io')).toBe('@Moheeb@deveco.io');
  });
});

describe('parseHandle', () => {
  it('parses @user@host', () => {
    expect(parseHandle('@moheeb@commonpub.io')).toEqual({ username: 'moheeb', instance: 'commonpub.io' });
  });

  it('parses user@host without leading @', () => {
    expect(parseHandle('moheeb@commonpub.io')).toEqual({ username: 'moheeb', instance: 'commonpub.io' });
  });

  it('parses acct:user@host (WebFinger form)', () => {
    expect(parseHandle('acct:moheeb@commonpub.io')).toEqual({ username: 'moheeb', instance: 'commonpub.io' });
  });

  it('lowercases the instance host', () => {
    expect(parseHandle('@moheeb@CommonPub.IO')?.instance).toBe('commonpub.io');
  });

  it('returns null for bare username', () => {
    expect(parseHandle('moheeb')).toBeNull();
  });

  it('returns null for missing user', () => {
    expect(parseHandle('@@commonpub.io')).toBeNull();
  });

  it('returns null for missing instance', () => {
    expect(parseHandle('@moheeb@')).toBeNull();
  });

  it('returns null for instance without dot', () => {
    expect(parseHandle('@moheeb@localhost')).toBeNull();
  });

  it('returns null for double-@ in middle', () => {
    expect(parseHandle('@a@b@c.com')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(parseHandle('  @moheeb@commonpub.io  ')).toEqual({ username: 'moheeb', instance: 'commonpub.io' });
  });
});

describe('hasAllScopes', () => {
  it('returns true when granted covers required', () => {
    expect(hasAllScopes(['read', 'write'], ['read'])).toBe(true);
    expect(hasAllScopes(['read', 'write', 'publish'], ['read', 'publish'])).toBe(true);
  });

  it('returns false when a required scope is missing', () => {
    expect(hasAllScopes(['read'], ['read', 'write'])).toBe(false);
    expect(hasAllScopes([], ['read'])).toBe(false);
  });

  it('returns true for an empty required set (vacuously true)', () => {
    expect(hasAllScopes([], [])).toBe(true);
    expect(hasAllScopes(['read'], [])).toBe(true);
  });
});

describe('coerceScopes', () => {
  it('drops unknown values', () => {
    expect(coerceScopes(['read', 'admin', 'publish', 'foo'])).toEqual(['read', 'publish']);
  });

  it('returns an empty array for all-unknown input', () => {
    expect(coerceScopes(['admin', 'super'])).toEqual([]);
  });

  it('preserves order of known scopes', () => {
    expect(coerceScopes(['publish', 'read', 'write'])).toEqual(['publish', 'read', 'write']);
  });
});

describe('isUsableLinkedIdentity', () => {
  it('false for native identity', () => {
    expect(isUsableLinkedIdentity(NATIVE)).toBe(false);
  });

  it('true for active linked identity', () => {
    expect(isUsableLinkedIdentity(makeLinked())).toBe(true);
  });

  it('false for revoked linked identity', () => {
    const revoked = makeLinked({ revokedAt: new Date() });
    expect(isUsableLinkedIdentity(revoked)).toBe(false);
  });

  it('narrows to LinkedIdentity at the type level', () => {
    const id: Identity = makeLinked();
    if (isUsableLinkedIdentity(id)) {
      // should compile — id is narrowed to LinkedIdentity
      expect(id.scopes).toEqual(['read', 'write']);
      expect(id.softwareKind).toBe('cpub');
    } else {
      throw new Error('expected linked');
    }
  });
});
