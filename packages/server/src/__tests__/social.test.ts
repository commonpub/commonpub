import { describe, it, expect } from 'vitest';

describe('social module', () => {
  it('should export like functions', async () => {
    const mod = await import('../social');
    expect(typeof mod.toggleLike).toBe('function');
    expect(typeof mod.isLiked).toBe('function');
  });

  it('should export comment functions', async () => {
    const mod = await import('../social');
    expect(typeof mod.listComments).toBe('function');
    expect(typeof mod.createComment).toBe('function');
    expect(typeof mod.deleteComment).toBe('function');
  });

  it('should export bookmark function', async () => {
    const mod = await import('../social');
    expect(typeof mod.toggleBookmark).toBe('function');
  });

  it('should export federation hook', async () => {
    const mod = await import('../social');
    expect(typeof mod.onContentLiked).toBe('function');
  });
});
