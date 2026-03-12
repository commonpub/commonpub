import { describe, it, expect } from 'vitest';

describe('profile module', () => {
  it('should export getUserByUsername', async () => {
    const mod = await import('../profile');
    expect(typeof mod.getUserByUsername).toBe('function');
  });

  it('should export getUserContent', async () => {
    const mod = await import('../profile');
    expect(typeof mod.getUserContent).toBe('function');
  });
});
