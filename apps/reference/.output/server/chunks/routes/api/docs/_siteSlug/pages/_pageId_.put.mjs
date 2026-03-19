import { d as defineEventHandler, u as useDB, ad as updateDocsPage, ae as updateDocsPageSchema } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../../_/validate.mjs';
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

const _pageId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { pageId } = parseParams(event, { pageId: "uuid" });
  const input = await parseBody(event, updateDocsPageSchema);
  return updateDocsPage(db, pageId, user.id, input);
});

export { _pageId__put as default };
//# sourceMappingURL=_pageId_.put.mjs.map
