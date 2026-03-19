import { d as defineEventHandler, u as useDB, bK as contentItems, b$ as users, a_ as listHubs, bl as listPaths, ax as setResponseHeader, ay as useRuntimeConfig } from '../nitro/nitro.mjs';
import { eq } from 'drizzle-orm';
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
const sitemap_xml = defineEventHandler(async (event) => {
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const publishedContent = await db.select({
    type: contentItems.type,
    slug: contentItems.slug,
    updatedAt: contentItems.updatedAt
  }).from(contentItems).where(eq(contentItems.status, "published"));
  const publicUsers = await db.select({
    username: users.username,
    updatedAt: users.updatedAt
  }).from(users).where(eq(users.status, "active"));
  const { items: hubs } = await listHubs(db, { limit: 100 });
  const { items: paths } = await listPaths(db, { status: "published", limit: 100 });
  const urls = [];
  urls.push({ loc: siteUrl, lastmod: (/* @__PURE__ */ new Date()).toISOString(), priority: "1.0", changefreq: "daily" });
  urls.push({ loc: `${siteUrl}/search`, lastmod: (/* @__PURE__ */ new Date()).toISOString(), priority: "0.5", changefreq: "weekly" });
  for (const item of publishedContent) {
    urls.push({
      loc: `${siteUrl}/${item.type}/${item.slug}`,
      lastmod: new Date(item.updatedAt).toISOString(),
      priority: "0.8",
      changefreq: "weekly"
    });
  }
  for (const user of publicUsers) {
    urls.push({
      loc: `${siteUrl}/profile/${user.username}`,
      lastmod: new Date(user.updatedAt).toISOString(),
      priority: "0.6",
      changefreq: "weekly"
    });
  }
  for (const hub of hubs) {
    urls.push({
      loc: `${siteUrl}/hubs/${hub.slug}`,
      lastmod: new Date(hub.createdAt).toISOString(),
      priority: "0.7",
      changefreq: "weekly"
    });
  }
  for (const path of paths) {
    urls.push({
      loc: `${siteUrl}/learn/${path.slug}`,
      lastmod: new Date(path.createdAt).toISOString(),
      priority: "0.7",
      changefreq: "monthly"
    });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=3600, stale-while-revalidate=1800");
  return xml;
});

export { sitemap_xml as default };
//# sourceMappingURL=sitemap.xml.mjs.map
