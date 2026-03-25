import { listContent, getUserByUsername } from '@commonpub/server';

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
  const { username } = parseParams(event, { username: 'string' });


  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  const { items } = await listContent(db, {
    status: 'published',
    authorId: user.id,
    sort: 'recent',
    limit: 50,
  });

  const displayName = user.displayName ?? user.username;
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
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(displayName)} — CommonPub</title>
    <link>${escapeXml(siteUrl)}/profile/${escapeXml(username)}</link>
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
