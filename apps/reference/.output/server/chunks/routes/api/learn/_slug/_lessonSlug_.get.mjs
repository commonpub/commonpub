import { d as defineEventHandler, u as useDB, a as getRouterParam, b0 as getLessonBySlug, f as createError } from '../../../../nitro/nitro.mjs';
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

const _lessonSlug__get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const lessonSlug = getRouterParam(event, "lessonSlug");
  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  }
  return lesson;
});

export { _lessonSlug__get as default };
//# sourceMappingURL=_lessonSlug_.get.mjs.map
