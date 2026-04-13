/**
 * One-time data migration: article → blog type merge.
 *
 * Converts content_items with type='article' to type='blog', preserving the
 * original intent by setting category='article' (only when category is empty).
 *
 * Handles the edge case where the same author has both type='article' and
 * type='blog' with the same slug — appends '-2' to the article's slug before
 * converting to avoid unique constraint violation on (authorId, type, slug).
 *
 * Idempotent — safe to run on every startup. Once no article rows remain,
 * this is a no-op SELECT that returns 0.
 *
 * Can be removed after confirming both instances have been migrated.
 */
import { contentItems } from '@commonpub/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';

export default defineNitroPlugin((nitro) => {
  setTimeout(async () => {
    try {
      const db = useDB();

      const [{ count: articleCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentItems)
        .where(eq(contentItems.type, 'article'));

      if (articleCount === 0) return;

      // Handle slug collisions: if author has both article/slug and blog/slug,
      // rename the article's slug before converting type
      await db.execute(sql`
        UPDATE content_items a
        SET slug = a.slug || '-2'
        WHERE a.type = 'article'
          AND EXISTS (
            SELECT 1 FROM content_items b
            WHERE b.type = 'blog'
              AND b.author_id = a.author_id
              AND b.slug = a.slug
          )
      `);

      // Set category='article' for rows that don't already have a category,
      // so the original "article" intent is preserved as metadata
      await db
        .update(contentItems)
        .set({ category: 'article' })
        .where(and(
          eq(contentItems.type, 'article'),
          isNull(contentItems.category),
        ));

      // Convert the type
      await db
        .update(contentItems)
        .set({ type: 'blog' })
        .where(eq(contentItems.type, 'article'));

      console.log(`[migrate-article-to-blog] Converted ${articleCount} article(s) to blog type (category preserved)`);
    } catch (err) {
      // Log but don't crash the app — migration can retry on next restart
      console.warn('[migrate-article-to-blog] Migration failed, will retry on next restart:', (err as Error).message);
    }
  }, 3000);
});
