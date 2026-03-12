import { eq } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';
import { typeToUrlSegment } from '$lib/utils/content-helpers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const items = await locals.db
    .select({
      slug: contentItems.slug,
      type: contentItems.type,
      updatedAt: contentItems.updatedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.status, 'published'));

  const origin = url.origin;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${items
  .map(
    (item) => `  <url>
    <loc>${origin}/${typeToUrlSegment(item.type)}/${item.slug}</loc>
    <lastmod>${item.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'max-age=3600',
    },
  });
};
