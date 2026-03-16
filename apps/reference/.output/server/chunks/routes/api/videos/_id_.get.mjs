import { d as defineEventHandler, u as useDB, a as getRouterParam, o as createError, aG as getVideoById, aH as incrementVideoViewCount } from '../../../nitro/nitro.mjs';
import 'drizzle-orm';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const _id__get = defineEventHandler(async (event) => {
  useDB();
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "ID required" });
  const video = await getVideoById();
  if (!video) throw createError({ statusCode: 404, message: "Video not found" });
  await incrementVideoViewCount();
  return video;
});

export { _id__get as default };
//# sourceMappingURL=_id_.get.mjs.map
