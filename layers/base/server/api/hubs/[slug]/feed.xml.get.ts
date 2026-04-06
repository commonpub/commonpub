import { getHubBySlug, listHubGallery } from '@commonpub/server';

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
  const { slug } = parseParams(event, { slug: 'string' });


  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const { items } = await listHubGallery(db, hub.id, { limit: 50 });

  const lastBuildDate = items.length > 0 && items[0].publishedAt
    ? new Date(items[0].publishedAt).toUTCString()
    : new Date().toUTCString();

  const rssItems = items.map((item) => {
    const link = `${siteUrl}/u/${item.author.username}/${item.type}/${item.slug}`;
    const pubDate = item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml((item as any).description ?? item.title)}</description>
      <author>${escapeXml(item.author.displayName ?? item.author.username)}</author>
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(hub.name)} — CommonPub</title>
    <link>${escapeXml(siteUrl)}/hubs/${escapeXml(slug)}</link>
    <description>${escapeXml(hub.description ?? `Content from ${hub.name}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/hubs/${escapeXml(slug)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
  return xml;
});
