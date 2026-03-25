import { createInvite, getHubBySlug } from '@commonpub/server';
import type { HubInviteItem } from '@commonpub/server';
import { createInviteSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubInviteItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, createInviteSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const invite = await createInvite(
    db,
    user.id,
    hub.id,
    input.maxUses,
    input.expiresAt ? new Date(input.expiresAt) : undefined,
  );
  if (!invite) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to create invites' });
  }
  return invite;
});
