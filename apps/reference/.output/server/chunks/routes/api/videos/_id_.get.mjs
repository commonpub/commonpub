import { d as defineEventHandler, u as useDB, c7 as getVideoById, p as createError, c8 as incrementVideoViewCount } from '../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
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

const _id__get = defineEventHandler(async (event) => {
  const db = useDB();
  const { id } = parseParams(event, { id: "uuid" });
  const video = await getVideoById(db, id);
  if (!video) throw createError({ statusCode: 404, statusMessage: "Video not found" });
  await incrementVideoViewCount(db, id);
  return video;
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
