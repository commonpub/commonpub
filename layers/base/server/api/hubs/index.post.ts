import { createHub } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { createHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createHubSchema);

  return createHub(db, user.id, input);
});
