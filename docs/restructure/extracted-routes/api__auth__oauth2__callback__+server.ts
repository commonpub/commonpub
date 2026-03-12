import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** OAuth2 Callback — Consumer side
 * Handles the redirect from a remote instance after authorization.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return json({ error, description: url.searchParams.get('error_description') }, { status: 400 });
  }

  if (!code) {
    return json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // In production: decode state to get instanceDomain, exchange code for token,
  // fetch user info, create/link federated account
  // For v1: placeholder response
  return json({
    success: true,
    message: 'OAuth2 callback received. Account linking implementation in Phase 9.',
    code,
    state,
  });
};
