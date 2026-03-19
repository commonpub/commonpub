import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, aq as getHubBySlug, av as listHubGallery, aw as setResponseHeader, ax as useRuntimeConfig } from '../../../../nitro/nitro.mjs';
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
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const { items } = await listHubGallery(db, hub.id, { limit: 50 });
  const lastBuildDate = items.length > 0 ? new Date((_a = items[0].publishedAt) != null ? _a : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b2, _c;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml((_b2 = item.description) != null ? _b2 : "")}</description>
      <author>${escapeXml((_c = item.author.displayName) != null ? _c : item.author.username)}</author>
      <category>${escapeXml(item.type)}</category>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(hub.name)} \u2014 CommonPub</title>
    <link>${escapeXml(siteUrl)}/hubs/${escapeXml(slug)}</link>
    <description>${escapeXml((_b = hub.description) != null ? _b : `Content from ${hub.name}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/hubs/${escapeXml(slug)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

export { feed_xml_get as default };
//# sourceMappingURL=feed.xml.get.mjs.map
