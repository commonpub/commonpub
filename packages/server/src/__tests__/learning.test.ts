import { describe, it, expect } from 'vitest';

describe('learning module', () => {
  it('should export path CRUD functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.listPaths).toBe('function');
    expect(typeof mod.getPathBySlug).toBe('function');
    expect(typeof mod.createPath).toBe('function');
    expect(typeof mod.updatePath).toBe('function');
    expect(typeof mod.deletePath).toBe('function');
    expect(typeof mod.publishPath).toBe('function');
  });

  it('should export module CRUD functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.createModule).toBe('function');
    expect(typeof mod.updateModule).toBe('function');
    expect(typeof mod.deleteModule).toBe('function');
    expect(typeof mod.reorderModules).toBe('function');
  });

  it('should export lesson CRUD functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.createLesson).toBe('function');
    expect(typeof mod.updateLesson).toBe('function');
    expect(typeof mod.deleteLesson).toBe('function');
    expect(typeof mod.reorderLessons).toBe('function');
  });

  it('should export enrollment functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.enroll).toBe('function');
    expect(typeof mod.unenroll).toBe('function');
    expect(typeof mod.getEnrollment).toBe('function');
    expect(typeof mod.getUserEnrollments).toBe('function');
  });

  it('should export progress and certificate functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.markLessonComplete).toBe('function');
    expect(typeof mod.getUserCertificates).toBe('function');
    expect(typeof mod.getCertificateByCode).toBe('function');
    expect(typeof mod.getCompletedLessonIds).toBe('function');
  });

  it('should export lesson query functions', async () => {
    const mod = await import('../learning');
    expect(typeof mod.getLessonBySlug).toBe('function');
  });
});
