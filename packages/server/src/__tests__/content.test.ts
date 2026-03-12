import { describe, it, expect } from 'vitest';
import { generateSlug, hasPermission, canManageRole } from '../utils';

describe('content module', () => {
  it('should export listContent', async () => {
    const mod = await import('../content');
    expect(typeof mod.listContent).toBe('function');
  });

  it('should export getContentBySlug', async () => {
    const mod = await import('../content');
    expect(typeof mod.getContentBySlug).toBe('function');
  });

  it('should export createContent', async () => {
    const mod = await import('../content');
    expect(typeof mod.createContent).toBe('function');
  });

  it('should export updateContent', async () => {
    const mod = await import('../content');
    expect(typeof mod.updateContent).toBe('function');
  });

  it('should export deleteContent', async () => {
    const mod = await import('../content');
    expect(typeof mod.deleteContent).toBe('function');
  });

  it('should export publishContent', async () => {
    const mod = await import('../content');
    expect(typeof mod.publishContent).toBe('function');
  });

  it('should export incrementViewCount', async () => {
    const mod = await import('../content');
    expect(typeof mod.incrementViewCount).toBe('function');
  });

  it('should export federation hooks', async () => {
    const mod = await import('../content');
    expect(typeof mod.onContentPublished).toBe('function');
    expect(typeof mod.onContentUpdated).toBe('function');
    expect(typeof mod.onContentDeleted).toBe('function');
  });
});

describe('generateSlug (content context)', () => {
  it('should lowercase and hyphenate a title', () => {
    expect(generateSlug('My First Blog Post')).toBe('my-first-blog-post');
  });

  it('should strip punctuation from titles', () => {
    expect(generateSlug('Hello, World! How are you?')).toBe('hello-world-how-are-you');
  });

  it('should collapse multiple spaces and underscores into single hyphens', () => {
    expect(generateSlug('too   many   spaces')).toBe('too-many-spaces');
    expect(generateSlug('under_score_title')).toBe('under-score-title');
  });

  it('should strip leading and trailing hyphens', () => {
    expect(generateSlug('---leading')).toBe('leading');
    expect(generateSlug('trailing---')).toBe('trailing');
    expect(generateSlug('---both---')).toBe('both');
  });

  it('should handle mixed special characters in realistic titles', () => {
    expect(generateSlug('Building a REST API w/ Node.js & Express'))
      .toBe('building-a-rest-api-w-nodejs-express');
    expect(generateSlug('C++ vs Rust: A Comparison (2024)'))
      .toBe('c-vs-rust-a-comparison-2024');
  });

  it('should truncate slugs longer than 100 characters', () => {
    const longTitle = 'This is a very long title that should be truncated because it exceeds the maximum slug length of one hundred characters total';
    const slug = generateSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(slug).toBe(generateSlug(longTitle)); // deterministic
  });

  it('should handle whitespace-only input', () => {
    expect(generateSlug('   ')).toBe('');
  });

  it('should handle numeric titles', () => {
    expect(generateSlug('123 456')).toBe('123-456');
  });
});

describe('hasPermission (content moderation context)', () => {
  it('should allow moderators to delete posts', () => {
    expect(hasPermission('moderator', 'deletePost')).toBe(true);
  });

  it('should allow moderators to pin and lock posts', () => {
    expect(hasPermission('moderator', 'pinPost')).toBe(true);
    expect(hasPermission('moderator', 'lockPost')).toBe(true);
  });

  it('should deny members from deleting posts', () => {
    expect(hasPermission('member', 'deletePost')).toBe(false);
  });

  it('should deny unknown roles all permissions', () => {
    expect(hasPermission('guest', 'deletePost')).toBe(false);
    expect(hasPermission('guest', 'editCommunity')).toBe(false);
  });

  it('should deny any role for unknown permissions', () => {
    expect(hasPermission('owner', 'destroyUniverse')).toBe(false);
    expect(hasPermission('admin', 'nonexistent')).toBe(false);
  });

  it('should allow admins to kick and ban users', () => {
    expect(hasPermission('admin', 'kickMember')).toBe(true);
    expect(hasPermission('admin', 'banUser')).toBe(true);
  });
});

describe('canManageRole (content author management)', () => {
  it('should not allow moderator to manage admin', () => {
    expect(canManageRole('moderator', 'admin')).toBe(false);
  });

  it('should not allow moderator to manage owner', () => {
    expect(canManageRole('moderator', 'owner')).toBe(false);
  });

  it('should allow moderator to manage member', () => {
    expect(canManageRole('moderator', 'member')).toBe(true);
  });

  it('should deny unknown roles from managing anyone', () => {
    expect(canManageRole('guest', 'member')).toBe(false);
    expect(canManageRole('visitor', 'member')).toBe(false);
  });

  it('should allow any role to manage an unknown role (level 0)', () => {
    // unknown target has level 0, any known role has level >= 1
    expect(canManageRole('member', 'unknown')).toBe(true);
    expect(canManageRole('moderator', 'nonexistent')).toBe(true);
  });

  it('should not allow owner to manage owner (same level)', () => {
    expect(canManageRole('owner', 'owner')).toBe(false);
  });
});
