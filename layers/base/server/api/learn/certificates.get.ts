import { getUserCertificates } from '@commonpub/server';
import type { CertificateItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<CertificateItem[]> => {
  const user = requireAuth(event);
  const db = useDB();

  return getUserCertificates(db, user.id);
});
