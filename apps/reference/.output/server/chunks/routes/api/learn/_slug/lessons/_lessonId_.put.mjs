import { d as defineEventHandler, u as useDB, bf as updateLesson, p as createError } from '../../../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../../../_/auth.mjs';
import { a as parseParams, b as parseBody } from '../../../../../_/validate.mjs';
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

const updateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(["article", "video", "quiz", "project", "explainer"]).optional(),
  content: z.unknown().optional(),
  contentItemId: z.string().uuid().nullable().optional(),
  durationMinutes: z.number().int().min(0).max(9999).optional()
});
const _lessonId__put = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { lessonId } = parseParams(event, { lessonId: "uuid" });
  const input = await parseBody(event, updateLessonSchema);
  const result = await updateLesson(db, lessonId, user.id, input);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Lesson not found or not authorized" });
  }
  return result;
});

export { _lessonId__put as default };
//# sourceMappingURL=_lessonId_.put.mjs.map
