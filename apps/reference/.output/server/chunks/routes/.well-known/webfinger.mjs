import { d as defineEventHandler, g as getQuery, o as createError, aq as parseWebFingerResource, ap as getRequestURL, u as useDB, an as getUserByUsername, ar as setResponseHeader, as as buildWebFingerResponse } from '../../nitro/nitro.mjs';
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
