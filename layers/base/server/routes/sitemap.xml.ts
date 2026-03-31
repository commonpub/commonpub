import { eq } from 'drizzle-orm';
import { contentItems, users } from '@commonpub/schema';
import { listHubs, listPaths } from '@commonpub/server';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl as string;

  // Published content
  const publishedContent = await db
    .select({
      type: contentItems.type,
      slug: contentItems.slug,
      updatedAt: contentItems.updatedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.status, 'published'));

  // Users with public profiles
  const publicUsers = await db
    .select({
      username: users.username,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.status, 'active'));

  // Hubs
  const { items: hubs } = await listHubs(db, { limit: 100 });

  // Learning paths
  const { items: paths } = await listPaths(db, { status: 'published', limit: 100 });

  const urls: Array<{ loc: string; lastmod: string; priority: string; changefreq: string }> = [];

  // Static pages
  urls.push({ loc: siteUrl, lastmod: new Date().toISOString(), priority: '1.0', changefreq: 'daily' });
  urls.push({ loc: `${siteUrl}/search`, lastmod: new Date().toISOString(), priority: '0.5', changefreq: 'weekly' });

  // Content pages
  for (const item of publishedContent) {
    urls.push({
      loc: `${siteUrl}/${item.type}/${item.slug}`,
      lastmod: new Date(item.updatedAt).toISOString(),
      priority: '0.8',
      changefreq: 'weekly',
    });
  }

  // User profiles
  for (const user of publicUsers) {
    urls.push({
      loc: `${siteUrl}/u/${user.username}`,
      lastmod: new Date(user.updatedAt).toISOString(),
      priority: '0.6',
      changefreq: 'weekly',
    });
  }

  // Hub pages (skip federated hubs — they have canonical URLs on the origin)
  for (const hub of hubs) {
    if ('source' in hub && hub.source === 'federated') continue;
    const localHub = hub as { slug: string; createdAt: Date; updatedAt?: Date };
    urls.push({
      loc: `${siteUrl}/hubs/${localHub.slug}`,
      lastmod: new Date(localHub.updatedAt ?? localHub.createdAt ?? new Date()).toISOString(),
      priority: '0.7',
      changefreq: 'weekly',
    });
  }

  // Learning paths
  for (const path of paths) {
    urls.push({
      loc: `${siteUrl}/learn/${path.slug}`,
      lastmod: new Date((path as any).updatedAt ?? (path as any).createdAt ?? new Date()).toISOString(),
      priority: '0.7',
      changefreq: 'monthly',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');
  return xml;
});
