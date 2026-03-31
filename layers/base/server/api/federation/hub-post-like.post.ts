import { likeFederatedHubPost } from '@commonpub/server';
import { federatedHubPosts, activities, remoteActors } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import { AP_CONTEXT, AP_PUBLIC } from '@commonpub/protocol';
import { z } from 'zod';

const schema = z.object({
  federatedHubPostId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
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

  // Increment local like count
  await likeFederatedHubPost(db, federatedHubPostId);

  // Queue outbound Like activity
  const localActorUri = `https://${config.instance.domain}/users/${user.username}`;

  // Find the post author's inbox for delivery
  const [author] = await db
    .select({ inbox: remoteActors.inbox })
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, post.actorUri))
    .limit(1);

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

  return { success: true };
});
