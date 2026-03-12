import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseWebFingerResource, buildWebFingerResponse } from '@commonpub/protocol';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  const resource = url.searchParams.get('resource');
  if (!resource) {
    return json({ error: 'resource parameter is required' }, { status: 400 });
  }

  const parsed = parseWebFingerResource(resource);
  if (!parsed) {
    return json({ error: 'Invalid resource format' }, { status: 400 });
  }

  const domain = locals.config.instance.domain;
  if (parsed.domain !== domain) {
    return json({ error: 'Unknown domain' }, { status: 404 });
  }

  const rows = await locals.db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, parsed.username))
    .limit(1);

  if (rows.length === 0) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  const user = rows[0]!;
  const actorUri = `https://${domain}/users/${user.username}`;
  const oauthEndpoint = `https://${domain}/api/auth/oauth2/authorize`;

  const response = buildWebFingerResponse({
    username: user.username,
    domain,
    actorUri,
    oauthEndpoint,
  });

  return json(response, {
    headers: { 'Content-Type': 'application/jrd+json' },
  });
};
