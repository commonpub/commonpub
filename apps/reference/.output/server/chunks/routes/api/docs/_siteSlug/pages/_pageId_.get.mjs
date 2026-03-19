import { d as defineEventHandler, u as useDB, W as getQuery, a6 as getDocsSiteBySlug, p as createError, aa as listDocsPages, ac as renderMarkdown } from '../../../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../../../_/validate.mjs';
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

const _pageId__get = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const { siteSlug, pageId: pageSlug } = parseParams(event, { siteSlug: "string", pageId: "string" });
  const query = getQuery(event);
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  const version = query.version ? result.versions.find((v) => v.version === query.version) : (_a = result.versions.find((v) => v.isDefault)) != null ? _a : result.versions[0];
  if (!version) throw createError({ statusCode: 404, statusMessage: "No version found" });
  const pages = await listDocsPages(db, version.id);
  const page = pages.find((p) => p.slug === pageSlug);
  if (!page) throw createError({ statusCode: 404, statusMessage: "Page not found" });
  const rendered = await renderMarkdown((_b = page.content) != null ? _b : "");
  return {
    ...page,
    html: rendered.html,
    toc: rendered.toc,
    frontmatter: rendered.frontmatter
  };
});

export { _pageId__get as default };
//# sourceMappingURL=_pageId_.get.mjs.map
