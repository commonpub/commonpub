import { z } from 'zod';

const authorizeQuerySchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  response_type: z.string(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

/**
 * OAuth2 authorize endpoint (GET).
 * Returns the authorization parameters for the consent page to render.
 * The actual authorization happens via POST after user consents.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const user = requireAuth(event);
  const query = parseQueryParams(event, authorizeQuerySchema);

  // Return params for the consent page to display
  return {
    clientId: query.client_id,
    redirectUri: query.redirect_uri,
    responseType: query.response_type,
    scope: query.scope,
    state: query.state,
    user: { username: user.username },
  };
});
