import { getFederatedContent } from '@commonpub/server';
import type { FederatedContentItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<FederatedContentItem> => {
  requireFeature('federation');
  requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const content = await getFederatedContent(db, id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Federated content not found' });
  }

  return content;
});
