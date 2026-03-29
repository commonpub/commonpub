import { processDynamicRegistration } from '@commonpub/server';
import { z } from 'zod';

const registerSchema = z.object({
  client_name: z.string().min(1).max(255),
  redirect_uris: z.array(z.string().url()).min(1),
  client_uri: z.string().url().optional(),
  instance_domain: z.string().min(3).max(255),
});

/**
 * Dynamic OAuth client registration endpoint.
 * Allows remote CommonPub instances to auto-register for SSO.
 * No auth required — the whole point is zero-friction instance-to-instance setup.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const input = await parseBody(event, registerSchema);

  const result = await processDynamicRegistration(db, {
    clientName: input.client_name,
    redirectUris: input.redirect_uris,
    clientUri: input.client_uri,
    instanceDomain: input.instance_domain,
  });

  if ('error' in result) {
    throw createError({
      statusCode: 400,
      statusMessage: result.errorDescription,
      data: { error: result.error },
    });
  }

  return {
    client_id: result.clientId,
    client_secret: result.clientSecret,
    registration_type: 'dynamic',
  };
});
