import { createHub } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { createHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createHubSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createHub(db, user.id, parsed.data);
});
