import { joinHub, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ joined: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  // Read optional invite token from body (required for non-open hubs)
  const body = await readBody(event).catch(() => null);
  const inviteToken = typeof body?.inviteToken === 'string' ? body.inviteToken : undefined;

  return joinHub(db, user.id, community.id, inviteToken);
});
