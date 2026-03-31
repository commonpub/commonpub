import { registerOAuthClient } from '@commonpub/server';
import { z } from 'zod';

const registerSchema = z.object({
  instanceDomain: z.string().min(3).max(255),
  redirectUris: z.array(z.string().url()).min(1),
});

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireAdmin(event);
  const db = useDB();
  const { instanceDomain, redirectUris } = await parseBody(event, registerSchema);

  return registerOAuthClient(db, instanceDomain, redirectUris);
});
