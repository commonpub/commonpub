import { d as defineEventHandler, u as useDB, A as readBody, b5 as getLessonBySlug, p as createError, b6 as markLessonComplete } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
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

const complete_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, lessonSlug } = parseParams(event, { slug: "string", lessonSlug: "string" });
  const body = await readBody(event).catch(() => ({}));
  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  return markLessonComplete(db, user.id, result.lesson.id, body == null ? void 0 : body.quizScore, body == null ? void 0 : body.quizPassed);
});

export { complete_post as default };
//# sourceMappingURL=complete.post.mjs.map
