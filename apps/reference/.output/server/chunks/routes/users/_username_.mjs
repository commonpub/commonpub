import { d as defineEventHandler, a as getRouterParam, X as getRequestHeader, ch as sendRedirect, u as useDB, G as useConfig, bG as getUserByUsername, f as createError, ci as getOrCreateActorKeypair, aw as setResponseHeader } from '../../nitro/nitro.mjs';
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

const _username_ = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const accept = getRequestHeader(event, "accept") || "";
  if (!accept.includes("application/activity+json") && !accept.includes("application/ld+json")) {
    return sendRedirect(event, `/u/${username}`);
  }
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let publicKeyPem = "";
  try {
    const keypair = await getOrCreateActorKeypair(db, profile.id, domain);
    publicKeyPem = keypair.publicKeyPem;
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1"
    ],
    id: actorUri,
    type: "Person",
    preferredUsername: username,
    name: profile.displayName || username,
    summary: profile.bio || "",
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    url: `https://${domain}/u/${username}`,
    ...publicKeyPem ? {
      publicKey: {
        id: `${actorUri}#main-key`,
        owner: actorUri,
        publicKeyPem
      }
    } : {}
  };
});

export { _username_ as default };
//# sourceMappingURL=_username_.mjs.map
