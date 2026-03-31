import { removeContent, removeFederatedContent } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  try {
    return await removeContent(db, id, admin.id);
  } catch {
    // Content not found in local table — try federated content table
    return await removeFederatedContent(db, id, admin.id);
  }
});
