/**
 * Integration tests for the URL restructure (/{type}/{slug} → /u/{username}/{type}/{slug}).
 *
 * Tests the full chain: slug uniqueness scoping, author-disambiguated lookups,
 * apObjectId stamping, resolveContentObjectUri, and URL builder functions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createContent,
  getContentBySlug,
  updateContent,
  publishContent,
  onContentPublished,
} from '../content/content.js';
import {
  buildContentUri,
  resolveContentObjectUri,
} from '../federation/federation.js';
import { parseLocalContentUri } from '../federation/inboxHandlers.js';
import {
  buildContentPath,
  buildContentUrl,
  buildContentEditPath,
  buildContentNewPath,
} from '../query.js';
import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { CommonPubConfig } from '@commonpub/config';

describe('URL restructure', () => {
  let db: DB;
  let alice: { id: string; username: string };
  let bob: { id: string; username: string };

  beforeAll(async () => {
    db = await createTestDB();
    alice = await createTestUser(db, { username: 'alice', displayName: 'Alice' });
    bob = await createTestUser(db, { username: 'bob', displayName: 'Bob' });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // ---- URL Builder Functions ----

  describe('buildContentPath', () => {
    it('builds /u/{username}/{type}/{slug}', () => {
      expect(buildContentPath('alice', 'project', 'robot-arm')).toBe('/u/alice/project/robot-arm');
    });

    it('handles all content types', () => {
      for (const type of ['project', 'article', 'blog', 'explainer']) {
        expect(buildContentPath('bob', type, 'my-content')).toBe(`/u/bob/${type}/my-content`);
      }
    });
  });

  describe('buildContentUrl', () => {
    it('builds absolute URL with domain', () => {
      expect(buildContentUrl('hack.build', 'alice', 'project', 'robot-arm'))
        .toBe('https://hack.build/u/alice/project/robot-arm');
    });
  });

  describe('buildContentEditPath', () => {
    it('appends /edit', () => {
      expect(buildContentEditPath('alice', 'project', 'robot-arm'))
        .toBe('/u/alice/project/robot-arm/edit');
    });
  });

  describe('buildContentNewPath', () => {
    it('uses /new/edit', () => {
      expect(buildContentNewPath('alice', 'project'))
        .toBe('/u/alice/project/new/edit');
    });
  });

  // ---- Slug Uniqueness Scoping ----

  describe('author-scoped slug uniqueness', () => {
    it('allows two users to have the same slug for the same content type', async () => {
      const aliceContent = await createContent(db, alice.id, {
        type: 'project',
        title: 'Robot Arm',
      });

      const bobContent = await createContent(db, bob.id, {
        type: 'project',
        title: 'Robot Arm',
      });

      // Both should get the clean slug (no timestamp suffix)
      expect(aliceContent.slug).toBe('robot-arm');
      expect(bobContent.slug).toBe('robot-arm');

      // They should be different content items
      expect(aliceContent.id).not.toBe(bobContent.id);
      expect(aliceContent.author.username).toBe('alice');
      expect(bobContent.author.username).toBe('bob');
    });

    it('still prevents duplicate slugs for the same author+type', async () => {
      const first = await createContent(db, alice.id, {
        type: 'article',
        title: 'My Article',
      });

      const second = await createContent(db, alice.id, {
        type: 'article',
        title: 'My Article',
      });

      // First gets clean slug, second gets timestamp suffix
      expect(first.slug).toBe('my-article');
      expect(second.slug).toMatch(/^my-article-\d+$/);
    });

    it('allows same slug for different content types by same author', async () => {
      const project = await createContent(db, alice.id, {
        type: 'project',
        title: 'Unique Title For Test',
      });

      const article = await createContent(db, alice.id, {
        type: 'article',
        title: 'Unique Title For Test',
      });

      // Both get clean slug because (authorId, type, slug) is unique — different types
      expect(project.slug).toBe('unique-title-for-test');
      expect(article.slug).toBe('unique-title-for-test');
    });
  });

  // ---- Author-Disambiguated Lookups ----

  describe('getContentBySlug with author disambiguation', () => {
    it('returns correct content when authorUsername is provided', async () => {
      // Create colliding slugs — use requesterId to see drafts
      const a = await createContent(db, alice.id, { type: 'blog', title: 'Collision Test' });
      const b = await createContent(db, bob.id, { type: 'blog', title: 'Collision Test' });

      // requesterId = alice.id lets alice see her own draft
      const aliceResult = await getContentBySlug(db, 'collision-test', alice.id, 'alice');
      // requesterId = bob.id lets bob see his own draft
      const bobResult = await getContentBySlug(db, 'collision-test', bob.id, 'bob');

      expect(aliceResult).toBeDefined();
      expect(bobResult).toBeDefined();
      expect(aliceResult!.author.username).toBe('alice');
      expect(bobResult!.author.username).toBe('bob');
      expect(aliceResult!.id).not.toBe(bobResult!.id);
    });

    it('returns correct content when authorId is provided', async () => {
      await createContent(db, alice.id, { type: 'explainer', title: 'Author ID Test' });
      await createContent(db, bob.id, { type: 'explainer', title: 'Author ID Test' });

      const aliceResult = await getContentBySlug(db, 'author-id-test', alice.id, undefined, alice.id);
      const bobResult = await getContentBySlug(db, 'author-id-test', bob.id, undefined, bob.id);

      expect(aliceResult!.author.username).toBe('alice');
      expect(bobResult!.author.username).toBe('bob');
    });

    it('returns published content without requester context', async () => {
      const content = await createContent(db, alice.id, { type: 'blog', title: 'Public Lookup Test' });
      await publishContent(db, content.id, alice.id);

      // No requesterId, no authorUsername — should still find published content
      const result = await getContentBySlug(db, 'public-lookup-test');
      expect(result).toBeDefined();
      expect(result!.author.username).toBe('alice');
      expect(result!.status).toBe('published');
    });
  });

  // ---- apObjectId Stamping ----

  describe('apObjectId on publish', () => {
    it('stamps apObjectId with new-format URI on first publish', async () => {
      const content = await createContent(db, alice.id, {
        type: 'project',
        title: 'AP Object Test',
      });

      // Before publish: no apObjectId
      const [before] = await db.select({ apObjectId: contentItems.apObjectId })
        .from(contentItems).where(eq(contentItems.id, content.id));
      expect(before!.apObjectId).toBeNull();

      // Publish
      await publishContent(db, content.id, alice.id);
      const config = { instance: { domain: 'test.example.com' }, features: { federation: false } } as unknown as CommonPubConfig;
      await onContentPublished(db, content.id, config);

      // After publish: apObjectId stamped with new format
      const [after] = await db.select({ apObjectId: contentItems.apObjectId })
        .from(contentItems).where(eq(contentItems.id, content.id));
      expect(after!.apObjectId).toBe('https://test.example.com/u/alice/project/ap-object-test');
    });

    it('does not overwrite apObjectId on republish', async () => {
      const content = await createContent(db, bob.id, {
        type: 'article',
        title: 'Republish Test',
      });

      await publishContent(db, content.id, bob.id);
      const config = { instance: { domain: 'test.example.com' }, features: { federation: false } } as unknown as CommonPubConfig;
      await onContentPublished(db, content.id, config);

      const [first] = await db.select({ apObjectId: contentItems.apObjectId })
        .from(contentItems).where(eq(contentItems.id, content.id));
      const originalUri = first!.apObjectId;
      expect(originalUri).toBe('https://test.example.com/u/bob/blog/republish-test'); // article normalized to blog

      // Rename and republish
      await updateContent(db, content.id, bob.id, { title: 'Republish Test Renamed' });
      await onContentPublished(db, content.id, config);

      // apObjectId should NOT change (immutable after first publish)
      const [second] = await db.select({ apObjectId: contentItems.apObjectId })
        .from(contentItems).where(eq(contentItems.id, content.id));
      expect(second!.apObjectId).toBe(originalUri);
    });
  });

  // ---- resolveContentObjectUri ----

  describe('resolveContentObjectUri', () => {
    it('returns stored apObjectId when available', async () => {
      const content = await createContent(db, alice.id, {
        type: 'project',
        title: 'Resolve URI Test',
      });
      await publishContent(db, content.id, alice.id);
      const config = { instance: { domain: 'test.example.com' }, features: { federation: false } } as unknown as CommonPubConfig;
      await onContentPublished(db, content.id, config);

      const uri = await resolveContentObjectUri(db, content.id, 'other.domain.com');
      // Should return the STORED apObjectId (test.example.com), not construct from other.domain.com
      expect(uri).toBe('https://test.example.com/u/alice/project/resolve-uri-test');
    });

    it('constructs URI from author/type/slug when apObjectId is null', async () => {
      const content = await createContent(db, bob.id, {
        type: 'blog',
        title: 'No AP ID Test',
      });
      // Don't publish — apObjectId stays null

      const uri = await resolveContentObjectUri(db, content.id, 'hack.build');
      expect(uri).toBe('https://hack.build/u/bob/blog/no-ap-id-test');
    });

    it('returns null for nonexistent content', async () => {
      const uri = await resolveContentObjectUri(db, crypto.randomUUID(), 'test.com');
      expect(uri).toBeNull();
    });
  });

  // ---- Deprecated buildContentUri still works ----

  describe('buildContentUri (deprecated)', () => {
    it('still returns legacy /content/{slug} format', () => {
      expect(buildContentUri('example.com', 'my-project')).toBe(
        'https://example.com/content/my-project',
      );
    });
  });

  // ---- URI Parsing for Inbox Handlers ----

  describe('parseLocalContentUri', () => {
    it('parses new format /u/{username}/{type}/{slug}', () => {
      const result = parseLocalContentUri('https://example.com/u/alice/project/robot-arm');
      expect(result).toEqual({ username: 'alice', type: 'project', slug: 'robot-arm' });
    });

    it('parses new format with all content types', () => {
      for (const type of ['project', 'article', 'blog', 'explainer']) {
        const result = parseLocalContentUri(`https://example.com/u/bob/${type}/my-content`);
        expect(result).toEqual({ username: 'bob', type, slug: 'my-content' });
      }
    });

    it('parses legacy format /content/{slug}', () => {
      const result = parseLocalContentUri('https://example.com/content/robot-arm');
      expect(result).toEqual({ slug: 'robot-arm' });
      expect(result!.username).toBeUndefined();
      expect(result!.type).toBeUndefined();
    });

    it('falls back to last segment for unknown path shapes', () => {
      const result = parseLocalContentUri('https://example.com/something/else/my-slug');
      expect(result).toEqual({ slug: 'my-slug' });
    });

    it('returns null for empty paths', () => {
      expect(parseLocalContentUri('https://example.com/')).toBeNull();
    });

    it('returns null for invalid URIs', () => {
      expect(parseLocalContentUri('not-a-url')).toBeNull();
    });

    it('handles slugs with hyphens and numbers', () => {
      const result = parseLocalContentUri('https://example.com/u/alice/project/robot-arm-v2-2024');
      expect(result).toEqual({ username: 'alice', type: 'project', slug: 'robot-arm-v2-2024' });
    });

    it('does not confuse hub post URIs with content URIs', () => {
      // Hub post: /hubs/{slug}/posts/{id} — last segment is UUID, not content slug
      const result = parseLocalContentUri('https://example.com/hubs/devs/posts/550e8400-e29b-41d4-a716-446655440000');
      // Should return the UUID as slug (inbox handlers check for hub pattern separately)
      expect(result!.slug).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result!.username).toBeUndefined(); // Not a /u/ path
    });
  });

  // ---- Slug Update on Rename ----

  describe('slug update preserves author scoping', () => {
    it('renames slug within author scope without collision', async () => {
      const aliceContent = await createContent(db, alice.id, {
        type: 'project',
        title: 'Rename Source',
      });
      // Bob has a project with the target slug
      await createContent(db, bob.id, {
        type: 'project',
        title: 'Rename Target',
      });

      // Alice renames her content to match Bob's slug — should succeed (different author)
      const updated = await updateContent(db, aliceContent.id, alice.id, {
        title: 'Rename Target',
      });

      expect(updated).toBeDefined();
      expect(updated!.slug).toBe('rename-target');
      expect(updated!.author.username).toBe('alice');
    });
  });
});
