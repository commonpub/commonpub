import { describe, it, expect } from 'vitest';

describe('docs module', () => {
  it('should export site CRUD functions', async () => {
    const mod = await import('../docs');
    expect(typeof mod.listDocsSites).toBe('function');
    expect(typeof mod.getDocsSiteBySlug).toBe('function');
    expect(typeof mod.createDocsSite).toBe('function');
    expect(typeof mod.updateDocsSite).toBe('function');
    expect(typeof mod.deleteDocsSite).toBe('function');
  });

  it('should export version functions', async () => {
    const mod = await import('../docs');
    expect(typeof mod.createDocsVersion).toBe('function');
    expect(typeof mod.setDefaultVersion).toBe('function');
    expect(typeof mod.deleteDocsVersion).toBe('function');
  });

  it('should export page functions', async () => {
    const mod = await import('../docs');
    expect(typeof mod.listDocsPages).toBe('function');
    expect(typeof mod.getDocsPage).toBe('function');
    expect(typeof mod.createDocsPage).toBe('function');
    expect(typeof mod.updateDocsPage).toBe('function');
    expect(typeof mod.deleteDocsPage).toBe('function');
    expect(typeof mod.duplicateDocsPage).toBe('function');
    expect(typeof mod.reorderDocsPages).toBe('function');
  });

  it('should export search function', async () => {
    const mod = await import('../docs');
    expect(typeof mod.searchDocsPages).toBe('function');
  });
});
