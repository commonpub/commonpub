import { describe, it, expect } from 'vitest';

describe('admin module', () => {
  it('should export audit functions', async () => {
    const mod = await import('../admin');
    expect(typeof mod.createAuditEntry).toBe('function');
    expect(typeof mod.listAuditLogs).toBe('function');
  });

  it('should export platform stats', async () => {
    const mod = await import('../admin');
    expect(typeof mod.getPlatformStats).toBe('function');
  });

  it('should export user management functions', async () => {
    const mod = await import('../admin');
    expect(typeof mod.listUsers).toBe('function');
    expect(typeof mod.updateUserRole).toBe('function');
    expect(typeof mod.updateUserStatus).toBe('function');
    expect(typeof mod.deleteUser).toBe('function');
  });

  it('should export report functions', async () => {
    const mod = await import('../admin');
    expect(typeof mod.listReports).toBe('function');
    expect(typeof mod.resolveReport).toBe('function');
  });

  it('should export instance settings functions', async () => {
    const mod = await import('../admin');
    expect(typeof mod.getInstanceSettings).toBe('function');
    expect(typeof mod.getInstanceSetting).toBe('function');
    expect(typeof mod.setInstanceSetting).toBe('function');
  });

  it('should export content moderation', async () => {
    const mod = await import('../admin');
    expect(typeof mod.removeContent).toBe('function');
  });
});
