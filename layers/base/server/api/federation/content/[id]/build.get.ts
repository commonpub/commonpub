import { isFederatedBuildMarked } from '@commonpub/server';

// Hydration counterpart to the federated build toggle — see content/[id]/build.get.ts.
export default defineEventHandler(async (event): Promise<{ marked: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  return { marked: await isFederatedBuildMarked(db, id, user.id) };
});
