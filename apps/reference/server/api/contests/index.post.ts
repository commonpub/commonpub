import { createContest } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  return createContest(db, { ...body, createdBy: user.id });
});
