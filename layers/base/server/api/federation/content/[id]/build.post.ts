import { toggleFederatedBuildMark } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ marked: boolean; count: number }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return toggleFederatedBuildMark(db, id, user.id);
});
