import { listDocsSites } from '@commonpub/server';

export default defineEventHandler(async (_event) => {
  const db = useDB();
  return listDocsSites(db);
});
