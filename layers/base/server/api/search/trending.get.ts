import { eq, desc } from 'drizzle-orm';
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
    .where(eq(contentItems.status, 'published'))
    .orderBy(desc(contentItems.viewCount))
    .limit(8);

  return rows.map((r) => ({
    query: r.title,
    trend: r.viewCount,
  }));
});
