import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, c0 as getVideoById, c1 as incrementVideoViewCount } from '../../../nitro/nitro.mjs';
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

const _id__get = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "ID required" });
  const video = await getVideoById(db, id);
  if (!video) throw createError({ statusCode: 404, statusMessage: "Video not found" });
  await incrementVideoViewCount(db, id);
  return video;
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
