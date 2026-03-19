import { getUserEnrollments } from '@commonpub/server';
import type { EnrollmentItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<EnrollmentItem[]> => {
  const user = requireAuth(event);
  const db = useDB();

  return getUserEnrollments(db, user.id);
});
