import { likeFederatedHubPost, unlikeFederatedHubPost } from '@commonpub/server';
import { federatedHubPosts, federatedHubPostLikes, activities, remoteActors } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';
import { AP_CONTEXT, AP_PUBLIC } from '@commonpub/protocol';
import { z } from 'zod';

const schema = z.object({
  federatedHubPostId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean; liked: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubPostId } = await parseBody(event, schema);

  // Get the post's objectUri (the remote Note's AP URI) and author
  const [post] = await db
    .select({
      objectUri: federatedHubPosts.objectUri,
      actorUri: federatedHubPosts.actorUri,
    })
    .from(federatedHubPosts)
    .where(eq(federatedHubPosts.id, federatedHubPostId))
    .limit(1);

  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  // Check if user already liked this post
  const [existing] = await db
    .select({ id: federatedHubPostLikes.id })
    .from(federatedHubPostLikes)
    .where(and(
      eq(federatedHubPostLikes.postId, federatedHubPostId),
      eq(federatedHubPostLikes.userId, user.id),
    ))
    .limit(1);

  const localActorUri = `https://${config.instance.domain}/users/${user.username}`;

  if (existing) {
    // Unlike: remove like record, decrement counter, send Undo(Like)
    await db.delete(federatedHubPostLikes).where(eq(federatedHubPostLikes.id, existing.id));
    await unlikeFederatedHubPost(db, federatedHubPostId);

    // Find the original Like activity to reference in Undo
    const [likeAct] = await db
      .select({ id: activities.id, payload: activities.payload })
      .from(activities)
      .where(and(
        eq(activities.type, 'Like'),
        eq(activities.actorUri, localActorUri),
        eq(activities.objectUri, post.objectUri),
        eq(activities.direction, 'outbound'),
      ))
      .limit(1);

    const undoActivity = {
      '@context': AP_CONTEXT,
      type: 'Undo',
      id: `${localActorUri}/undo/${crypto.randomUUID()}`,
      actor: localActorUri,
      object: likeAct?.payload ?? {
        type: 'Like',
        actor: localActorUri,
        object: post.objectUri,
      },
      to: [post.actorUri],
      cc: [AP_PUBLIC],
    };

    await db.insert(activities).values({
      type: 'Undo',
      actorUri: localActorUri,
      objectUri: post.objectUri,
      payload: undoActivity,
      direction: 'outbound',
      status: 'pending',
    });

    return { success: true, liked: false };
  }

  // Like: insert like record, increment counter, send Like
  await db.insert(federatedHubPostLikes).values({
    postId: federatedHubPostId,
    userId: user.id,
  }).onConflictDoNothing();

  await likeFederatedHubPost(db, federatedHubPostId);

  const likeActivity = {
    '@context': AP_CONTEXT,
    type: 'Like',
    id: `${localActorUri}/likes/${crypto.randomUUID()}`,
    actor: localActorUri,
    object: post.objectUri,
    to: [post.actorUri],
    cc: [AP_PUBLIC],
  };

  await db.insert(activities).values({
    type: 'Like',
    actorUri: localActorUri,
    objectUri: post.objectUri,
    payload: likeActivity,
    direction: 'outbound',
    status: 'pending',
  });

  return { success: true, liked: true };
});
