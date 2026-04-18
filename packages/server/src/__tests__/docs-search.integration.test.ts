/**
 * Integration tests for docs FTS search.
 *
 * The content column is jsonb (BlockTuple[] for new pages, string for legacy
 * markdown). Session 128 audit found search was tokenizing the raw JSON
 * literal, producing snippets like `[["paragraph",{"html":""}]]`. Session 129
 * fixed the SQL to extract text from each block's data before building the
 * tsvector / ts_headline.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createDocsSite,
  createDocsPage,
  searchDocsPages,
} from '../docs/docs.js';
import { docsVersions } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

describe('docs search (Postgres FTS over BlockTuple content)', () => {
  let db: DB;
  let ownerId: string;
  let siteId: string;
  let versionId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const owner = await createTestUser(db, { username: 'docsowner' });
    ownerId = owner.id;

    const site = await createDocsSite(db, ownerId, {
      name: 'TinyML Docs',
      description: 'Docs',
    });
    siteId = site.id;

    const versions = await db.select().from(docsVersions).where(eq(docsVersions.siteId, siteId));
    versionId = versions[0]!.id;

    // A page with BlockTuple content containing the word "microcontroller"
    await createDocsPage(db, ownerId, {
      versionId,
      title: 'Intro to Microcontrollers',
      slug: 'intro',
      content: [
        ['heading', { text: 'Chapter 1', level: 2 }],
        ['paragraph', { html: '<p>A <strong>microcontroller</strong> is a small computer.</p>' }],
        ['code_block', { code: 'digitalWrite(LED, HIGH);', language: 'cpp' }],
      ],
    });

    // A page with content that should NOT match
    await createDocsPage(db, ownerId, {
      versionId,
      title: 'Setting Up',
      slug: 'setup',
      content: [
        ['paragraph', { html: '<p>Install the toolchain.</p>' }],
      ],
    });

  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('finds pages whose block content contains the search term', async () => {
    const results = await searchDocsPages(db, siteId, versionId, 'microcontroller');
    expect(results.length).toBeGreaterThan(0);
    const titles = results.map(r => r.title);
    expect(titles).toContain('Intro to Microcontrollers');
  });

  it('snippet is clean prose, not raw JSON keys', async () => {
    const results = await searchDocsPages(db, siteId, versionId, 'microcontroller');
    const match = results.find(r => r.title === 'Intro to Microcontrollers');
    expect(match).toBeDefined();
    // Must not contain the structural JSON artifacts from the old implementation.
    expect(match!.snippet).not.toMatch(/\[\[\s*"paragraph"/);
    expect(match!.snippet).not.toContain('"html":');
    expect(match!.snippet).not.toContain('\\"');
    // Must contain the actual word (possibly inside a ts_headline <b> marker).
    expect(match!.snippet.toLowerCase()).toContain('microcontroller');
  });

  it('matches words inside HTML tags (tags stripped before tokenizing)', async () => {
    // The word "strong" only appears inside the HTML markup of the block.
    // After tag stripping, it should NOT be indexed.
    const results = await searchDocsPages(db, siteId, versionId, 'strong');
    const match = results.find(r => r.title === 'Intro to Microcontrollers');
    expect(match).toBeUndefined();
  });

  it('matches words in code blocks', async () => {
    const results = await searchDocsPages(db, siteId, versionId, 'digitalWrite');
    const match = results.find(r => r.title === 'Intro to Microcontrollers');
    expect(match).toBeDefined();
  });

  it('returns empty for non-matching query', async () => {
    const results = await searchDocsPages(db, siteId, versionId, 'kubernetes');
    expect(results).toHaveLength(0);
  });

  it('returns empty for blank query', async () => {
    const results = await searchDocsPages(db, siteId, versionId, '   ');
    expect(results).toHaveLength(0);
  });

  it('handles prefix search via :* operator', async () => {
    // Query "microcont" should prefix-match "microcontroller"
    const results = await searchDocsPages(db, siteId, versionId, 'microcont');
    expect(results.length).toBeGreaterThan(0);
  });
});
