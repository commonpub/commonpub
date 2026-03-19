import { createVideo } from '@commonpub/server';
import type { VideoDetail } from '@commonpub/server';
import { createVideoSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createVideoSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createVideo(db, { ...parsed.data, authorId: user.id });
});
