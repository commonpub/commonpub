import { describe, it, expect } from 'vitest';

describe('federation module', () => {
  it('should export keypair management', async () => {
    const mod = await import('../federation');
    expect(typeof mod.getOrCreateActorKeypair).toBe('function');
  });

  it('should export actor resolution', async () => {
    const mod = await import('../federation');
    expect(typeof mod.resolveRemoteActor).toBe('function');
  });

  it('should export follow management functions', async () => {
    const mod = await import('../federation');
    expect(typeof mod.sendFollow).toBe('function');
    expect(typeof mod.acceptFollow).toBe('function');
    expect(typeof mod.rejectFollow).toBe('function');
    expect(typeof mod.unfollowRemote).toBe('function');
  });

  it('should export content federation functions', async () => {
    const mod = await import('../federation');
    expect(typeof mod.federateContent).toBe('function');
    expect(typeof mod.federateUpdate).toBe('function');
    expect(typeof mod.federateDelete).toBe('function');
    expect(typeof mod.federateLike).toBe('function');
    expect(typeof mod.federateComment).toBe('function');
  });

  it('should export query functions', async () => {
    const mod = await import('../federation');
    expect(typeof mod.getFollowers).toBe('function');
    expect(typeof mod.getFollowing).toBe('function');
    expect(typeof mod.listFederationActivity).toBe('function');
  });
});
