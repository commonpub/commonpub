import { getFederatedContent, listRemoteReplies } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Get the parent content to find its objectUri
  const content = await getFederatedContent(db, id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Federated content not found' });
  }

  const replies = await listRemoteReplies(db, content.objectUri);

  // Transform to comment-like shape for the UI
  return replies.map((r) => ({
    id: r.id,
    content: r.content ?? r.summary ?? '',
    createdAt: r.publishedAt ?? r.receivedAt,
    author: r.actor ? {
      id: '',
      username: r.actor.preferredUsername ?? 'unknown',
      displayName: r.actor.displayName ?? r.actor.preferredUsername ?? 'Unknown',
      avatarUrl: r.actor.avatarUrl ?? null,
    } : null,
    federated: true,
    originDomain: r.originDomain,
  }));
});
