import { describe, it, expect } from 'vitest';
import {
  createDocsSiteSchema,
  updateDocsSiteSchema,
  createDocsVersionSchema,
  createDocsPageSchema,
  updateDocsPageSchema,
} from '../validators';

describe('createDocsSiteSchema', () => {
  it('should accept a valid site', () => {
    const result = createDocsSiteSchema.safeParse({
      name: 'My Docs',
      slug: 'my-docs',
      description: 'A docs site',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createDocsSiteSchema.safeParse({ name: '', slug: 'my-docs' });
    expect(result.success).toBe(false);
  });

  it('should reject name over 128 chars', () => {
    const result = createDocsSiteSchema.safeParse({ name: 'a'.repeat(129), slug: 'my-docs' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug', () => {
    const result = createDocsSiteSchema.safeParse({ name: 'Test', slug: 'INVALID SLUG!' });
    expect(result.success).toBe(false);
  });

  it('should accept without description', () => {
    const result = createDocsSiteSchema.safeParse({ name: 'Test', slug: 'test' });
    expect(result.success).toBe(true);
  });
});

describe('updateDocsSiteSchema', () => {
  it('should accept partial update', () => {
    const result = updateDocsSiteSchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateDocsSiteSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('createDocsVersionSchema', () => {
  it('should accept a valid version', () => {
    const result = createDocsVersionSchema.safeParse({
      siteId: '550e8400-e29b-41d4-a716-446655440000',
      version: 'v1.0',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-uuid siteId', () => {
    const result = createDocsVersionSchema.safeParse({ siteId: 'bad', version: 'v1' });
    expect(result.success).toBe(false);
  });

  it('should reject version over 32 chars', () => {
    const result = createDocsVersionSchema.safeParse({
      siteId: '550e8400-e29b-41d4-a716-446655440000',
      version: 'a'.repeat(33),
    });
    expect(result.success).toBe(false);
  });
});

describe('createDocsPageSchema', () => {
  it('should accept a valid page', () => {
    const result = createDocsPageSchema.safeParse({
      versionId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Getting Started',
      slug: 'getting-started',
      content: '# Hello\n\nWelcome to the docs.',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing content', () => {
    const result = createDocsPageSchema.safeParse({
      versionId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test',
      slug: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional parentId and sortOrder', () => {
    const result = createDocsPageSchema.safeParse({
      versionId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Child Page',
      slug: 'child-page',
      content: 'Content',
      parentId: '660e8400-e29b-41d4-a716-446655440000',
      sortOrder: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateDocsPageSchema', () => {
  it('should accept partial update', () => {
    const result = updateDocsPageSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateDocsPageSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

