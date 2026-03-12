import { listComments } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = getQuery(event);

  return listComments(db, query.targetType as string, query.targetId as string);
});
