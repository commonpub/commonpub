import { d as defineEventHandler, u as useDB, a as getRouterParam, g as getQuery, f as createError, aq as getHubBySlug, av as listHubGallery } from '../../../../nitro/nitro.mjs';
import { z } from 'zod';
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
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const galleryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const gallery_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const query = galleryQuerySchema.parse(getQuery(event));
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return listHubGallery(db, hub.id, query);
});

export { gallery_get as default };
//# sourceMappingURL=gallery.get.mjs.map
