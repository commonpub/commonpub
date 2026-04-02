import { getFederatedHub, listFederatedHubPosts } from '@commonpub/server';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl as string;
  const { id } = parseParams(event, { id: 'uuid' });

  const hub = await getFederatedHub(db, id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
  }

  const { items } = await listFederatedHubPosts(db, id, { limit: 50 });

  const lastBuildDate = items.length > 0 && items[0]!.publishedAt
    ? new Date(items[0]!.publishedAt).toUTCString()
    : new Date().toUTCString();

  const rssItems = items.map((item) => {
    const title = item.sharedContentMeta?.title
      ? `Shared: ${item.sharedContentMeta.title}`
      : stripHtml(item.content).slice(0, 100) || 'Post';
    const link = item.objectUri;
    const pubDate = item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date(item.receivedAt).toUTCString();
    const authorName = item.author.displayName ?? item.author.preferredUsername ?? 'Unknown';
    const desc = stripHtml(item.content).slice(0, 300);

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
      <author>${escapeXml(authorName)}@${escapeXml(item.author.instanceDomain)}</author>
      <category>${escapeXml(item.postType)}</category>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(hub.name)} (via ${escapeXml(hub.originDomain)})</title>
    <link>${escapeXml(hub.url ?? `${siteUrl}/federated-hubs/${id}`)}</link>
    <description>${escapeXml(hub.description ?? `Posts from ${hub.name} on ${hub.originDomain}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/federated-hubs/${id}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=300');
  return xml;
});
