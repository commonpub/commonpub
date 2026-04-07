import { describe, it, expect } from 'vitest';
import * as docs from '../index';

describe('barrel export', () => {
  it('should export all public API', () => {
    // Validators
    expect(docs.createDocsSiteSchema).toBeDefined();
    expect(docs.updateDocsSiteSchema).toBeDefined();
    expect(docs.createDocsVersionSchema).toBeDefined();
    expect(docs.createDocsPageSchema).toBeDefined();
    expect(docs.updateDocsPageSchema).toBeDefined();
    // Rendering
    expect(docs.parseFrontmatter).toBeInstanceOf(Function);
    expect(docs.extractHeadings).toBeInstanceOf(Function);
    expect(docs.generateHeadingId).toBeInstanceOf(Function);
    expect(docs.renderMarkdown).toBeInstanceOf(Function);

    // Navigation
    expect(docs.buildPageTree).toBeInstanceOf(Function);
    expect(docs.buildBreadcrumbs).toBeInstanceOf(Function);
    expect(docs.buildPagePath).toBeInstanceOf(Function);
    // Versioning
    expect(docs.validateVersionString).toBeInstanceOf(Function);
    expect(docs.compareVersions).toBeInstanceOf(Function);
    expect(docs.selectDefaultVersion).toBeInstanceOf(Function);
    expect(docs.prepareVersionCopy).toBeInstanceOf(Function);

    // Search
    expect(docs.stripMarkdown).toBeInstanceOf(Function);
    expect(docs.buildSearchDocument).toBeInstanceOf(Function);
    expect(docs.buildSearchQuery).toBeInstanceOf(Function);
  });
});
