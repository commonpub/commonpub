import { listDocsSites } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  return listDocsSites(db);
});
