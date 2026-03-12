import { describe, it, expect } from 'vitest';

describe('community module', () => {
  it('should export community CRUD functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.listCommunities).toBe('function');
    expect(typeof mod.getCommunityBySlug).toBe('function');
    expect(typeof mod.createCommunity).toBe('function');
    expect(typeof mod.updateCommunity).toBe('function');
    expect(typeof mod.deleteCommunity).toBe('function');
  });

  it('should export membership functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.joinCommunity).toBe('function');
    expect(typeof mod.leaveCommunity).toBe('function');
    expect(typeof mod.getMember).toBe('function');
    expect(typeof mod.listMembers).toBe('function');
    expect(typeof mod.changeRole).toBe('function');
    expect(typeof mod.kickMember).toBe('function');
  });

  it('should export post and reply functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.createPost).toBe('function');
    expect(typeof mod.listPosts).toBe('function');
    expect(typeof mod.deletePost).toBe('function');
    expect(typeof mod.togglePinPost).toBe('function');
    expect(typeof mod.toggleLockPost).toBe('function');
    expect(typeof mod.createReply).toBe('function');
    expect(typeof mod.listReplies).toBe('function');
    expect(typeof mod.deleteReply).toBe('function');
  });

  it('should export ban functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.banUser).toBe('function');
    expect(typeof mod.unbanUser).toBe('function');
    expect(typeof mod.checkBan).toBe('function');
    expect(typeof mod.listBans).toBe('function');
  });

  it('should export invite functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.createInvite).toBe('function');
    expect(typeof mod.validateAndUseInvite).toBe('function');
    expect(typeof mod.revokeInvite).toBe('function');
    expect(typeof mod.listInvites).toBe('function');
  });

  it('should export content sharing functions', async () => {
    const mod = await import('../community');
    expect(typeof mod.shareContent).toBe('function');
    expect(typeof mod.unshareContent).toBe('function');
    expect(typeof mod.listShares).toBe('function');
  });
});
