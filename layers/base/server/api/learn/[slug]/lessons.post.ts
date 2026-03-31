import { createLesson } from '@commonpub/server';
import { createLessonSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createLessonSchema);

  return createLesson(db, user.id, input);
});
