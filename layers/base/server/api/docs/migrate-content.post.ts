/**
 * Migration endpoint: Convert docs pages from markdown (string) to BlockTuple[] (JSON).
 *
 * POST /api/docs/migrate-content
 *
 * Requires admin auth. Converts all docsPages where content is a markdown string
 * into BlockTuple[] JSON format using markdownToBlockTuples.
 *
 * This is a one-time migration. After running, the content column can be altered to JSONB.
 *
 * Run this BEFORE altering the column type:
 *   ALTER TABLE docs_pages ALTER COLUMN content TYPE jsonb USING content::jsonb;
 */
import { markdownToBlockTuples } from '@commonpub/editor';
import { docsPages } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);

  // Only allow admins to run migration
  if (!user.role || user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' });
  }

  const db = useDB();

  // Fetch all pages
  const allPages = await db.select().from(docsPages);

  let converted = 0;
  let skipped = 0;
  let errored = 0;
  const errors: Array<{ pageId: string; title: string; error: string }> = [];

  for (const page of allPages) {
    const content = page.content ?? '';

    // Skip if already JSON (starts with [ for BlockTuple array)
    if (typeof content === 'string' && content.startsWith('[')) {
      try {
        JSON.parse(content);
        skipped++;
        continue;
      } catch {
        // Not valid JSON, proceed with conversion
      }
    }

    // Skip empty content
    if (!content || (typeof content === 'string' && !content.trim())) {
      // Set empty content to an empty paragraph block
      try {
        await db
          .update(docsPages)
          .set({ content: JSON.stringify([['paragraph', { html: '' }]]) })
          .where(eq(docsPages.id, page.id));
        converted++;
      } catch (err: unknown) {
        errored++;
        errors.push({
          pageId: page.id,
          title: page.title,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      continue;
    }

    // Convert markdown to BlockTuples
    try {
      const blocks = markdownToBlockTuples(content as string);
      const jsonContent = JSON.stringify(blocks);

      await db
        .update(docsPages)
        .set({ content: jsonContent })
        .where(eq(docsPages.id, page.id));

      converted++;
    } catch (err: unknown) {
      errored++;
      errors.push({
        pageId: page.id,
        title: page.title,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    total: allPages.length,
    converted,
    skipped,
    errored,
    errors,
    nextStep: errored === 0
      ? 'All pages converted. You can now run: ALTER TABLE docs_pages ALTER COLUMN content TYPE jsonb USING content::jsonb;'
      : 'Some pages failed conversion. Fix errors and re-run.',
  };
});
