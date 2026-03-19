import { d as defineEventHandler, aB as setResponseHeader, aC as useRuntimeConfig } from '../nitro/nitro.mjs';
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

const robots_txt = defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const content = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/
Disallow: /messages/
Disallow: /create/

Sitemap: ${siteUrl}/sitemap.xml
`;
  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400");
  return content;
});

export { robots_txt as default };
//# sourceMappingURL=robots.txt.mjs.map
