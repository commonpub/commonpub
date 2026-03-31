import { createVideo } from '@commonpub/server';
import type { VideoDetail } from '@commonpub/server';
import { createVideoSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createVideoSchema);

  return createVideo(db, { ...input, authorId: user.id });
});
