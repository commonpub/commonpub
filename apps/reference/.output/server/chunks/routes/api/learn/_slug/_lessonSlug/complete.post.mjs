import { d as defineEventHandler, u as useDB, a as getRouterParam, c as readBody, b0 as getLessonBySlug, f as createError, b1 as markLessonComplete } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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

const complete_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const lessonSlug = getRouterParam(event, "lessonSlug");
  const body = await readBody(event).catch(() => ({}));
  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  return markLessonComplete(db, user.id, lesson.id, body == null ? void 0 : body.quizScore, body == null ? void 0 : body.quizPassed);
});

export { complete_post as default };
//# sourceMappingURL=complete.post.mjs.map
