import { d as defineEventHandler, u as useDB, N as listContent, aB as setResponseHeader, aC as useRuntimeConfig } from '../nitro/nitro.mjs';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:fs';
import 'node:fs/promises';
import 'node:path';
import 'node:stream/promises';
import 'node:crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const feed_xml = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const siteName = config.public.siteName;
  const siteDescription = config.public.siteDescription;
  const { items } = await listContent(db, {
    status: "published",
    sort: "recent",
    limit: 50
  });
  const lastBuildDate = items.length > 0 ? new Date((_a = items[0].publishedAt) != null ? _a : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b, _c;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml((_b = item.description) != null ? _b : "")}</description>
      <author>${escapeXml((_c = item.author.displayName) != null ? _c : item.author.username)}</author>
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
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

export { feed_xml as default };
//# sourceMappingURL=feed.xml.mjs.map
