import { listVideoCategories } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  return listVideoCategories(db);
});
