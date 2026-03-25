import { createDocsSite } from '@commonpub/server';
import { createDocsSiteSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createDocsSiteSchema);

  return createDocsSite(db, user.id, input);
});
