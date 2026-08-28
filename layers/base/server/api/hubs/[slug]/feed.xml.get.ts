import { getHubBySlug, listHubGallery } from '@commonpub/server';

/**
 * XML 1.0 permits only #x9, #xA, #xD and #x20 upward. A C0 control character is
 * illegal EVEN ESCAPED as a numeric reference, so a title carrying one (paste
 * from a PDF, a stray \x0b) makes the whole document malformed and every reader
 * rejects the feed rather than skipping the item. Strip before escaping.
 *
 * Kept byte-identical to the copies in the sibling XML routes and pinned by
 * `layers/base/server/routes/__tests__/xml-escape.test.ts`, so the five cannot
 * drift.
 */
function escapeXml(str: string): string {
  return (
    str
      // The control characters ARE the subject: this range is exactly what XML
      // 1.0 forbids, so `no-control-regex` is inverted here.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl as string;
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }
  requireHubReadAccess(event, hub);

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
    <title>${escapeXml(hub.name)}, CommonPub</title>
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
