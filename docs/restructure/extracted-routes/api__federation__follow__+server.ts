import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendFollow } from '$lib/server/federation';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let remoteActorUri: string;
  try {
    ({ remoteActorUri } = await request.json());
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!remoteActorUri) {
    return json({ error: 'remoteActorUri is required' }, { status: 400 });
  }

  const result = await sendFollow(
    locals.db,
    locals.user.id,
    remoteActorUri,
    locals.config.instance.domain,
  );

  return json(result, { status: 201 });
};
