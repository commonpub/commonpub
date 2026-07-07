import { describe, it, expect } from 'vitest';
import { generateSlug, hasPermission, canManageRole } from '../utils';

describe('utils', () => {
  describe('generateSlug', () => {
    it('should convert text to a URL-safe slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Hello, World!')).toBe('hello-world');
    });

    it('should handle leading/trailing whitespace', () => {
      expect(generateSlug('  Hello World  ')).toBe('hello-world');
    });

    it('should handle empty strings', () => {
      expect(generateSlug('')).toBe('');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(200);
      const slug = generateSlug(longString);
      expect(slug.length).toBeLessThanOrEqual(100);
    });

    it('should replace underscores with hyphens', () => {
      expect(generateSlug('hello_world_test')).toBe('hello-world-test');
    });

    it('should collapse consecutive spaces into a single hyphen', () => {
      expect(generateSlug('hello    world')).toBe('hello-world');
    });

    it('should strip leading and trailing hyphens after processing', () => {
      expect(generateSlug('---hello---')).toBe('hello');
      expect(generateSlug('!!!hello!!!')).toBe('hello');
    });

    it('should handle strings with only special characters', () => {
      expect(generateSlug('!@#$%^&*()')).toBe('');
    });

    it('should preserve numbers', () => {
      expect(generateSlug('version 2.0 release')).toBe('version-20-release');
    });

    it('should handle mixed case input', () => {
      expect(generateSlug('CamelCase AND UPPER')).toBe('camelcase-and-upper');
    });

    it('should produce exactly 100 chars for a long input', () => {
      // 120 word chars -> slug is 120 chars, sliced to 100
      const input = 'a'.repeat(120);
      expect(generateSlug(input)).toBe('a'.repeat(100));
    });

    it('should handle tabs and newlines as whitespace', () => {
      expect(generateSlug("hello\tworld\nfoo")).toBe('hello-world-foo');
    });

    it('should handle hyphens in original text', () => {
      expect(generateSlug('well-known-path')).toBe('well-known-path');
    });
  });

  describe('hasPermission', () => {
    it('should grant owner all permissions', () => {
      expect(hasPermission('owner', 'editHub')).toBe(true);
      expect(hasPermission('owner', 'banUser')).toBe(true);
      expect(hasPermission('owner', 'manageMembers')).toBe(true);
    });

    it('should grant admin admin-level permissions', () => {
      expect(hasPermission('admin', 'editHub')).toBe(true);
      expect(hasPermission('admin', 'manageMembers')).toBe(true);
      expect(hasPermission('admin', 'banUser')).toBe(true);
    });

    it('should grant moderator moderator-level permissions', () => {
      expect(hasPermission('moderator', 'banUser')).toBe(true);
      expect(hasPermission('moderator', 'deletePost')).toBe(true);
      expect(hasPermission('moderator', 'pinPost')).toBe(true);
    });

    it('should deny moderator admin-level permissions', () => {
      expect(hasPermission('moderator', 'editHub')).toBe(false);
      expect(hasPermission('moderator', 'manageMembers')).toBe(false);
    });

    it('should deny member most permissions', () => {
      expect(hasPermission('member', 'editHub')).toBe(false);
      expect(hasPermission('member', 'banUser')).toBe(false);
      expect(hasPermission('member', 'deletePost')).toBe(false);
    });

    it('grants steward EXACTLY discussion-moderation + flagging', () => {
      expect(hasPermission('steward', 'deletePost')).toBe(true);
      expect(hasPermission('steward', 'pinPost')).toBe(true);
      expect(hasPermission('steward', 'lockPost')).toBe(true);
      expect(hasPermission('steward', 'flagContent')).toBe(true);
      expect(hasPermission('steward', 'flagMember')).toBe(true);
    });

    it('DENIES steward every destructive / management permission (whitelist, no numeric leak)', () => {
      // kickMember/banUser share numeric level 2 with deletePost — the authoritative
      // whitelist must still deny them for steward.
      expect(hasPermission('steward', 'kickMember')).toBe(false);
      expect(hasPermission('steward', 'banUser')).toBe(false);
      expect(hasPermission('steward', 'manageMembers')).toBe(false);
      expect(hasPermission('steward', 'manageResources')).toBe(false);
      expect(hasPermission('steward', 'editHub')).toBe(false);
      expect(hasPermission('steward', 'reviewFlags')).toBe(false);
    });

    it('still lets moderator/admin flag + review (unchanged numeric roles)', () => {
      expect(hasPermission('moderator', 'flagContent')).toBe(true);
      expect(hasPermission('moderator', 'flagMember')).toBe(true);
      expect(hasPermission('moderator', 'reviewFlags')).toBe(false);
      expect(hasPermission('admin', 'reviewFlags')).toBe(true);
      expect(hasPermission('owner', 'reviewFlags')).toBe(true);
    });
  });

  describe('canManageRole', () => {
    it('should allow owner to manage all other roles', () => {
      expect(canManageRole('owner', 'admin')).toBe(true);
      expect(canManageRole('owner', 'moderator')).toBe(true);
      expect(canManageRole('owner', 'member')).toBe(true);
    });

    it('should allow admin to manage lower roles', () => {
      expect(canManageRole('admin', 'moderator')).toBe(true);
      expect(canManageRole('admin', 'member')).toBe(true);
    });

    it('should not allow admin to manage owner', () => {
      expect(canManageRole('admin', 'owner')).toBe(false);
    });

    it('should not allow same-level management', () => {
      expect(canManageRole('admin', 'admin')).toBe(false);
      expect(canManageRole('moderator', 'moderator')).toBe(false);
    });

    it('should not allow member to manage anyone at their level or above', () => {
      expect(canManageRole('member', 'member')).toBe(false);
      expect(canManageRole('member', 'moderator')).toBe(false);
      expect(canManageRole('member', 'admin')).toBe(false);
      expect(canManageRole('member', 'owner')).toBe(false);
    });

    it('should allow member to manage unknown roles (level 0)', () => {
      expect(canManageRole('member', 'guest')).toBe(true);
    });

    it('should not allow unknown role to manage any known role', () => {
      expect(canManageRole('guest', 'member')).toBe(false);
      expect(canManageRole('visitor', 'moderator')).toBe(false);
    });

    it('should not allow unknown role to manage unknown role (both level 0)', () => {
      expect(canManageRole('guest', 'visitor')).toBe(false);
    });
  });

  describe('hasPermission — edge cases', () => {
    it('should deny unknown permissions even for owner', () => {
      expect(hasPermission('owner', 'flyToMoon')).toBe(false);
    });

    it('should deny unknown role for all known permissions', () => {
      expect(hasPermission('guest', 'editHub')).toBe(false);
      expect(hasPermission('guest', 'banUser')).toBe(false);
      expect(hasPermission('guest', 'deletePost')).toBe(false);
    });

    it('should correctly check all moderator-level permissions', () => {
      const modPermissions = ['banUser', 'kickMember', 'deletePost', 'pinPost', 'lockPost'];
      for (const perm of modPermissions) {
        expect(hasPermission('moderator', perm)).toBe(true);
        expect(hasPermission('member', perm)).toBe(false);
      }
    });

    it('should correctly check all admin-level permissions', () => {
      const adminPermissions = ['editHub', 'manageMembers'];
      for (const perm of adminPermissions) {
        expect(hasPermission('admin', perm)).toBe(true);
        expect(hasPermission('owner', perm)).toBe(true);
        expect(hasPermission('moderator', perm)).toBe(false);
        expect(hasPermission('member', perm)).toBe(false);
      }
    });
  });
});
