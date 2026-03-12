import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activities } from '@commonpub/schema';
import { verifyHttpSignature } from '@commonpub/protocol';
import { resolveRemoteActor } from '$lib/server/federation';

/** Shared inbox — receives activities for any user on this instance */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify HTTP Signature
  const actorUri = body.actor as string;
  if (!actorUri) {
    return json({ error: 'Missing actor' }, { status: 400 });
  }

  const actor = await resolveRemoteActor(locals.db, actorUri);
  const publicKeyPem = actor?.publicKey?.publicKeyPem;

  if (publicKeyPem) {
    const signatureValid = await verifyHttpSignature(request, publicKeyPem);
    if (!signatureValid) {
      return json({ error: 'Invalid HTTP Signature' }, { status: 401 });
    }
  }

  try {
    // Log inbound activity
    await locals.db.insert(activities).values({
      type: (body.type as string) ?? 'Unknown',
      actorUri,
      objectUri: typeof body.object === 'string' ? body.object : null,
      payload: body,
      direction: 'inbound',
      status: 'pending',
    });

    return new Response(null, { status: 202 });
  } catch (err) {
    return json({ error: 'Failed to process activity' }, { status: 500 });
  }
};
