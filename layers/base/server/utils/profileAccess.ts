import type { H3Event } from 'h3';
import { canViewProfile, findProfileGate } from '@commonpub/server';

/**
 * 404 unless this viewer may see the member's profile (session 261).
 *
 * The rule is `canViewProfile` in @commonpub/server (public: anyone; members:
 * signed-in viewers; private: the member only). It throws the SAME 404 as an
 * account that does not exist, so a hidden profile cannot be told apart from no
 * profile. Every `/api/users/:username/*` read calls this before anything else.
 */
export async function requireVisibleProfile(event: H3Event, username: string): Promise<{ id: string }> {
  const gate = await findProfileGate(useDB(), username);
  if (!gate || !canViewProfile(gate, getOptionalUser(event)?.id)) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  return gate;
}
