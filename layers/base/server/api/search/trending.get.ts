import { and, eq, desc } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';

export default defineEventHandler(async (): Promise<Array<{ query: string; trend: number }>> => {
  const db = useDB();

  // Return the most-viewed content titles as "trending searches"
  const rows = await db
    .select({
      title: contentItems.title,
      viewCount: contentItems.viewCount,
    })
    .from(contentItems)
    // Trending "searches" expose content titles; restrict to live-public items so a
    // members/private title can't surface as a suggested query (P-1b).
    .where(and(eq(contentItems.status, 'published'), eq(contentItems.visibility, 'public')))
    .orderBy(desc(contentItems.viewCount))
    .limit(8);

  return rows.map((r) => ({
    query: r.title,
    trend: r.viewCount,
  }));
});
