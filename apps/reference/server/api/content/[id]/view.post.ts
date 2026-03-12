import { incrementViewCount } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  await incrementViewCount(db, id);
  return { success: true };
});
