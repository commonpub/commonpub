import { d as defineEventHandler, cl as getMethod, p as createError, A as readBody, cm as processInboxActivity } from '../../../nitro/nitro.mjs';
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

const inboxCallbacks = {
  async onFollow(actorUri, targetActorUri, activityId) {
    console.log("[user-inbox] Follow:", actorUri, "\u2192", targetActorUri, activityId);
  },
  async onAccept(actorUri, objectId) {
    console.log("[user-inbox] Accept:", actorUri, objectId);
  },
  async onReject(actorUri, objectId) {
    console.log("[user-inbox] Reject:", actorUri, objectId);
  },
  async onUndo(actorUri, objectType, objectId) {
    console.log("[user-inbox] Undo:", actorUri, objectType, objectId);
  },
  async onCreate(actorUri, object) {
    console.log("[user-inbox] Create:", actorUri, object.type);
  },
  async onUpdate(actorUri, object) {
    console.log("[user-inbox] Update:", actorUri, object.type);
  },
  async onDelete(actorUri, objectId) {
    console.log("[user-inbox] Delete:", actorUri, objectId);
  },
  async onLike(actorUri, objectUri) {
    console.log("[user-inbox] Like:", actorUri, objectUri);
  },
  async onAnnounce(actorUri, objectUri) {
    console.log("[user-inbox] Announce:", actorUri, objectUri);
  }
};
const inbox = defineEventHandler(async (event) => {
  var _a;
  const method = getMethod(event);
  if (method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }
  const body = await readBody(event);
  try {
    const result = await processInboxActivity(body, inboxCallbacks);
    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: (_a = result.error) != null ? _a : "Invalid activity" });
    }
    return { status: "accepted" };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("[user-inbox]", err);
    throw createError({ statusCode: 400, statusMessage: "Invalid activity" });
  }
});

export { inbox as default };
//# sourceMappingURL=inbox.mjs.map
