import { d as defineEventHandler, W as getQuery, p as createError, cj as parseWebFingerResource, ci as getRequestURL, u as useDB, bN as getUserByUsername, aB as setResponseHeader, ck as buildWebFingerResponse } from '../../nitro/nitro.mjs';
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

const webfinger = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const resource = query.resource;
  if (!resource) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing resource parameter"
    });
  }
  const parsed = parseWebFingerResource(resource);
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid resource format. Expected acct:user@domain"
    });
  }
  const requestUrl = getRequestURL(event);
  const instanceDomain = requestUrl.host;
  if (parsed.domain !== instanceDomain) {
    throw createError({
      statusCode: 404,
      statusMessage: "Resource not found on this instance"
    });
  }
  const db = useDB();
  const profile = await getUserByUsername(db, parsed.username);
  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found"
    });
  }
  const actorUri = `https://${instanceDomain}/users/${parsed.username}`;
  setResponseHeader(event, "content-type", "application/jrd+json");
  return buildWebFingerResponse({
    username: parsed.username,
    domain: instanceDomain,
    actorUri
  });
});

export { webfinger as default };
//# sourceMappingURL=webfinger.mjs.map
