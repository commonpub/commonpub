import { toggleBuildMark } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ marked: boolean; count: number }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return toggleBuildMark(db, id, user.id);
});
