import { d as defineEventHandler, u as useDB, a as getRouterParam, f as createError, aj as files, ak as createStorageFromEnv } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
import { and, eq } from 'drizzle-orm';
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

let storage = null;
function getStorage() {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}
const _id__delete = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "File ID is required" });
  }
  const result = await db.delete(files).where(and(eq(files.id, id), eq(files.uploaderId, user.id))).returning({ id: files.id, storageKey: files.storageKey });
  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "File not found or not owned by you" });
  }
  try {
    const adapter = getStorage();
    await adapter.delete(result[0].storageKey);
  } catch {
    console.warn(`[files] Failed to delete storage key: ${result[0].storageKey}`);
  }
  return { deleted: true };
});

export { _id__delete as default };
//# sourceMappingURL=_id_.delete.mjs.map
