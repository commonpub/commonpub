import { addTrustedInstance } from '@commonpub/server';
import { z } from 'zod';

const addSchema = z.object({
  domain: z.string().min(3).max(255).regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
});

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  const { domain } = await parseBody(event, addSchema);

  await addTrustedInstance(db, domain.toLowerCase());

  return { success: true, domain: domain.toLowerCase() };
});
