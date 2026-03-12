import { getUserEnrollments } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();

  return getUserEnrollments(db, user.id);
});
