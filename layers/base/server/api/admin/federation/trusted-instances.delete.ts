import { removeTrustedInstance } from '@commonpub/server';
import { z } from 'zod';

const removeSchema = z.object({
  domain: z.string().min(3).max(255),
});

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requirePermission(event, 'federation.manage');
  const db = useDB();
  const { domain } = await parseBody(event, removeSchema);

  await removeTrustedInstance(db, domain.toLowerCase());

  return { success: true };
});
