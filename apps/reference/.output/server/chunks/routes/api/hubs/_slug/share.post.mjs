import { d as defineEventHandler, u as useDB, av as getHubBySlug, p as createError, b0 as shareContent } from '../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../_/validate.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const shareContentSchema = z.object({
  contentId: z.string().uuid()
});
const share_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: "string" });
  const input = await parseBody(event, shareContentSchema);
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return shareContent(db, user.id, hub.id, input.contentId);
});

export { share_post as default };
//# sourceMappingURL=share.post.mjs.map
