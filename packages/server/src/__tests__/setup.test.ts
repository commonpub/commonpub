import { describe, it, expect } from 'vitest';

describe('@commonpub/server barrel export', () => {
  it('imports cleanly and exports core module groups', async () => {
    const mod = await import('../index');

    // Verify each module group has at least one function — catches broken barrel exports
    // Content
    expect(typeof mod.listContent).toBe('function');
    expect(typeof mod.createContent).toBe('function');
    // Hubs
    expect(typeof mod.listHubs).toBe('function');
    expect(typeof mod.createHub).toBe('function');
    // Social
    expect(typeof mod.toggleLike).toBe('function');
    expect(typeof mod.listComments).toBe('function');
    // Docs
    expect(typeof mod.listDocsSites).toBe('function');
    expect(typeof mod.createDocsPage).toBe('function');
    // Admin
    expect(typeof mod.listUsers).toBe('function');
    expect(typeof mod.listReports).toBe('function');
    // Learning
    expect(typeof mod.listPaths).toBe('function');
    expect(typeof mod.enroll).toBe('function');
    // Profile
    expect(typeof mod.getUserByUsername).toBe('function');
    // Federation
    expect(typeof mod.federateContent).toBe('function');
    expect(typeof mod.resolveRemoteActor).toBe('function');
    // Theme
    expect(typeof mod.resolveTheme).toBe('function');
    // Security
    expect(typeof mod.buildCspDirectives).toBe('function');
    expect(typeof mod.checkRateLimit).toBe('function');
    // Contest
    expect(typeof mod.listContests).toBe('function');
    // Notification
    expect(typeof mod.listNotifications).toBe('function');
    // Messaging
    expect(typeof mod.listConversations).toBe('function');
    // Video
    expect(typeof mod.listVideos).toBe('function');
    // Hooks
    expect(typeof mod.onHook).toBe('function');
    expect(typeof mod.emitHook).toBe('function');
    // Utils
    expect(typeof mod.generateSlug).toBe('function');
    expect(typeof mod.escapeLike).toBe('function');
  });
});
