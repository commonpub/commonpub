import { describe, it, expect } from 'vitest';
import { hasPermissionPure } from '../permissions';

describe('hasPermissionPure', () => {
  describe('admin floor (INV-2)', () => {
    it('admin primaryRole passes any key regardless of grant set', () => {
      expect(hasPermissionPure(new Set(), 'admin.access', 'admin')).toBe(true);
      expect(hasPermissionPure([], 'content.moderate', 'admin')).toBe(true);
      expect(hasPermissionPure(new Set(), 'roles.manage', 'admin')).toBe(true);
    });

    it('admin floor survives an empty/failed resolver (no grants present)', () => {
      // Simulates a role_permissions outage: empty set, but role says admin.
      expect(hasPermissionPure(new Set(), 'settings.manage', 'admin')).toBe(true);
    });

    it('non-admin role does NOT get the floor', () => {
      expect(hasPermissionPure(new Set(), 'admin.access', 'staff')).toBe(false);
      expect(hasPermissionPure(new Set(), 'admin.access', 'member')).toBe(false);
    });
  });

  describe('full wildcard', () => {
    it('a `*` grant passes everything', () => {
      const g = new Set(['*']);
      expect(hasPermissionPure(g, 'admin.access')).toBe(true);
      expect(hasPermissionPure(g, 'content.editorial')).toBe(true);
      expect(hasPermissionPure(g, 'federation.manage')).toBe(true);
    });
  });

  describe('exact match', () => {
    it('grants only the exact key', () => {
      const g = new Set(['content.moderate']);
      expect(hasPermissionPure(g, 'content.moderate')).toBe(true);
      expect(hasPermissionPure(g, 'content.editorial')).toBe(false);
      expect(hasPermissionPure(g, 'content.read')).toBe(false);
    });

    it('accepts an array grant source as well as a Set', () => {
      expect(hasPermissionPure(['users.read'], 'users.read')).toBe(true);
      expect(hasPermissionPure(['users.read'], 'users.manage')).toBe(false);
    });
  });

  describe('segment wildcard', () => {
    it('`<prefix>.*` covers any key under that prefix', () => {
      const g = new Set(['content.*']);
      expect(hasPermissionPure(g, 'content.read')).toBe(true);
      expect(hasPermissionPure(g, 'content.moderate')).toBe(true);
      expect(hasPermissionPure(g, 'content.editorial')).toBe(true);
    });

    it('a prefix wildcard does NOT leak into a sibling prefix', () => {
      const g = new Set(['content.*']);
      expect(hasPermissionPure(g, 'users.read')).toBe(false);
      expect(hasPermissionPure(g, 'admin.access')).toBe(false);
    });

    it('`admin.*` covers admin.access', () => {
      expect(hasPermissionPure(new Set(['admin.*']), 'admin.access')).toBe(true);
    });
  });

  describe('default deny (INV-3)', () => {
    it('empty set + non-admin denies', () => {
      expect(hasPermissionPure(new Set(), 'content.read')).toBe(false);
      expect(hasPermissionPure([], 'content.read', 'member')).toBe(false);
    });

    it('an unknown/unrelated grant denies the needed key', () => {
      expect(hasPermissionPure(new Set(['theme.manage']), 'storage.manage')).toBe(false);
    });

    it('never throws on odd input', () => {
      expect(() => hasPermissionPure(new Set(), '')).not.toThrow();
      expect(hasPermissionPure(new Set(), '')).toBe(false);
    });
  });
});
