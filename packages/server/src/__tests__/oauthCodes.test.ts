import { describe, it, expect } from 'vitest';

describe('oauthCodes module', () => {
  it('should export storeAuthCode', async () => {
    const mod = await import('../oauthCodes');
    expect(typeof mod.storeAuthCode).toBe('function');
  });

  it('should export consumeAuthCode', async () => {
    const mod = await import('../oauthCodes');
    expect(typeof mod.consumeAuthCode).toBe('function');
  });

  it('should export cleanupExpiredCodes', async () => {
    const mod = await import('../oauthCodes');
    expect(typeof mod.cleanupExpiredCodes).toBe('function');
  });
});
