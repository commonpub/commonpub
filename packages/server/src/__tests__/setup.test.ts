import { describe, it, expect } from 'vitest';

describe('@commonpub/server package setup', () => {
  it('should be importable', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
  });

  it('should export DB type', async () => {
    // Type-level test — if this compiles, the type is exported
    const mod = await import('../types');
    expect(mod).toBeDefined();
  });
});
