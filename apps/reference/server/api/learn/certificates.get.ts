import { getUserCertificates } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();

  return getUserCertificates(db, user.id);
});
