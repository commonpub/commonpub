import { incrementViewCount } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  await incrementViewCount(db, id);
  return { success: true };
});
