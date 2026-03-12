import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processInboxActivity, verifyHttpSignature } from '@commonpub/protocol';
import { eq, and } from 'drizzle-orm';
import { users, activities, followRelationships } from '@commonpub/schema';
import { acceptFollow, resolveRemoteActor } from '$lib/server/federation';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  // Verify the target user exists
  const rows = await locals.db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, params.username))
    .limit(1);

  if (rows.length === 0) {
    error(404, 'User not found');
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

  const domain = locals.config.instance.domain;
  const db = locals.db;

  // Log inbound activity
  await db.insert(activities).values({
    type: (body.type as string) ?? 'Unknown',
    actorUri: (body.actor as string) ?? '',
    objectUri:
      typeof body.object === 'string'
        ? body.object
        : (((body.object as Record<string, unknown>)?.id as string) ?? null),
    payload: body,
    direction: 'inbound',
    status: 'processed',
  });

  const result = await processInboxActivity(body, {
    async onFollow(actorUri, targetActorUri, _activityId) {
      // Auto-accept follows for now (v1)
      const [rel] = await db
        .insert(followRelationships)
        .values({
          followerActorUri: actorUri,
          followingActorUri: targetActorUri,
          status: 'accepted',
        })
        .returning();

      // Log Accept response
      if (rel) {
        await acceptFollow(db, rel.id, domain);
      }
    },
    async onAccept(_actorUri, _objectId) {
      // Update our follow relationship to accepted
      await db
        .update(followRelationships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(
          eq(followRelationships.followerActorUri, `https://${domain}/users/${params.username}`),
        );
    },
    async onReject(_actorUri, _objectId) {
      await db
        .update(followRelationships)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(
          eq(followRelationships.followerActorUri, `https://${domain}/users/${params.username}`),
        );
    },
    async onUndo(actorUri, objectType, _objectId) {
      if (objectType === 'Follow') {
        await db
          .delete(followRelationships)
          .where(
            and(
              eq(followRelationships.followerActorUri, actorUri),
              eq(
                followRelationships.followingActorUri,
                `https://${domain}/users/${params.username}`,
              ),
            ),
          );
      }
    },
    async onCreate(_actorUri, _object) {
      // Store remote content reference — full implementation in Phase 9
    },
    async onUpdate(_actorUri, _object) {
      // Update remote content reference — full implementation in Phase 9
    },
    async onDelete(_actorUri, _objectId) {
      // Remove remote content reference — full implementation in Phase 9
    },
    async onLike(_actorUri, _objectUri) {
      // Record remote like — full implementation in Phase 9
    },
    async onAnnounce(_actorUri, _objectUri) {
      // Record remote boost — full implementation in Phase 9
    },
  });

  if (!result.success) {
    return json({ error: result.error }, { status: 400 });
  }

  return new Response(null, { status: 202 });
};
