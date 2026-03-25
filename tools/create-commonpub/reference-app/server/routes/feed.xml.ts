import { listContent } from '@commonpub/server';

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
  const siteName = config.public.siteName as string;
  const siteDescription = config.public.siteDescription as string;

  const { items } = await listContent(db, {
    status: 'published',
    sort: 'recent',
    limit: 50,
  });

  const lastBuildDate = items.length > 0
    ? new Date(items[0].publishedAt ?? items[0].createdAt).toUTCString()
    : new Date().toUTCString();

  const rssItems = items.map((item) => {
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date(item.publishedAt ?? item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(item.description ?? '')}</description>
      <author>${escapeXml(item.author.displayName ?? item.author.username)}</author>
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
  return xml;
});
