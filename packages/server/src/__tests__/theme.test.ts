import { describe, it, expect } from 'vitest';

describe('theme module', () => {
  it('should export resolveTheme', async () => {
    const mod = await import('../theme');
    expect(typeof mod.resolveTheme).toBe('function');
  });

  it('should export getCustomTokenOverrides', async () => {
    const mod = await import('../theme');
    expect(typeof mod.getCustomTokenOverrides).toBe('function');
  });

  it('should export setUserTheme', async () => {
    const mod = await import('../theme');
    expect(typeof mod.setUserTheme).toBe('function');
  });
});
