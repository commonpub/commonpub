import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, bG as getUserByUsername, O as listContent, aw as setResponseHeader, ax as useRuntimeConfig } from '../../../../nitro/nitro.mjs';
import 'drizzle-orm';
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
const feed_xml_get = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const username = getRouterParam(event, "username");
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username required" });
  }
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  const { items } = await listContent(db, {
    status: "published",
    authorId: user.id,
    sort: "recent",
    limit: 50
  });
  const displayName = (_a = user.displayName) != null ? _a : user.username;
  const lastBuildDate = items.length > 0 ? new Date((_b = items[0].publishedAt) != null ? _b : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b2;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml((_b2 = item.description) != null ? _b2 : "")}</description>
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(displayName)} \u2014 CommonPub</title>
    <link>${escapeXml(siteUrl)}/profile/${escapeXml(username)}</link>
    <description>Content by ${escapeXml(displayName)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/users/${escapeXml(username)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

export { feed_xml_get as default };
//# sourceMappingURL=feed.xml.get.mjs.map
