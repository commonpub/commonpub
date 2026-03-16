import { createConversation } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const body = await readBody(event);

  const participants: string[] = body.participants;
  if (!participants.includes(user.id)) {
    participants.push(user.id);
  }

  return createConversation(db, participants);
});
