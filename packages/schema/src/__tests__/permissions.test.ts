import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  isPermissionKey,
  isPermissionGrant,
  permissionKeySchema,
  filterKnownPermissions,
} from '../permissions';

describe('permission catalog', () => {
  it('is non-empty, unique, and includes the two bypass keys', () => {
    expect(PERMISSIONS.length).toBeGreaterThan(0);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    expect(PERMISSIONS).toContain('*');
    expect(PERMISSIONS).toContain('admin.access');
  });

  it('every non-wildcard key is `<segment>.<segment>` (one dot)', () => {
    for (const key of PERMISSIONS) {
      if (key === '*') continue;
      expect(key.split('.').length).toBe(2);
      expect(key).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('includes contest.pii (entrant-PII read capability, Phase 4)', () => {
    expect(PERMISSIONS).toContain('contest.pii');
    expect(isPermissionGrant('contest.pii')).toBe(true);
    expect(permissionKeySchema.safeParse('contest.pii').success).toBe(true);
  });
});

describe('isPermissionKey', () => {
  it('accepts exact catalog keys only', () => {
    expect(isPermissionKey('content.moderate')).toBe(true);
    expect(isPermissionKey('admin.access')).toBe(true);
    expect(isPermissionKey('*')).toBe(true);
    expect(isPermissionKey('content.*')).toBe(false); // wildcard is a grant, not a key
    expect(isPermissionKey('nonsense.key')).toBe(false);
  });
});

describe('isPermissionGrant / permissionKeySchema', () => {
  it('accepts `*`, exact keys, and recognized segment wildcards', () => {
    for (const v of ['*', 'content.moderate', 'content.*', 'admin.*', 'users.*']) {
      expect(isPermissionGrant(v)).toBe(true);
      expect(permissionKeySchema.safeParse(v).success).toBe(true);
    }
  });

  it('rejects unknown keys and unknown segment-wildcard prefixes', () => {
    for (const v of ['nonsense', 'nonsense.*', 'content.nonsense', 'foo.bar', '']) {
      expect(isPermissionGrant(v)).toBe(false);
      expect(permissionKeySchema.safeParse(v).success).toBe(false);
    }
  });

  it('does NOT treat a bare prefix as a grant (must be `prefix.*`)', () => {
    expect(isPermissionGrant('content')).toBe(false);
    expect(isPermissionGrant('admin')).toBe(false);
  });
});

describe('filterKnownPermissions', () => {
  it('drops unrecognized grants, keeps valid ones', () => {
    expect(filterKnownPermissions(['content.*', 'bogus', 'admin.access', 'x.*'])).toEqual([
      'content.*',
      'admin.access',
    ]);
  });
});
