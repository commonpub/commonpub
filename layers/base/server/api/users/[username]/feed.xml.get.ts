import { listContent, getUserByUsername } from '@commonpub/server';

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
  const { username } = parseParams(event, { username: 'string' });


  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  const { items } = await listContent(db, {
    status: 'published',
    authorId: user.id,
    // Public per-user RSS: never leak the author members-only/private items (P-1 site 4).
    visibility: 'public',
    sort: 'recent',
    limit: 50,
  });

  const displayName = user.displayName ?? user.username;
  const lastBuildDate = items.length > 0
    ? new Date(items[0].publishedAt ?? items[0].createdAt).toUTCString()
    : new Date().toUTCString();

  const rssItems = items.map((item) => {
    const link = `${siteUrl}/u/${item.author.username}/${item.type}/${item.slug}`;
    const pubDate = new Date(item.publishedAt ?? item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(item.description ?? '')}</description>
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(displayName)}, CommonPub</title>
    <link>${escapeXml(siteUrl)}/u/${escapeXml(username)}</link>
    <description>Content by ${escapeXml(displayName)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/users/${escapeXml(username)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
  return xml;
});
