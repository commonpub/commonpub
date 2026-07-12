import { getHubBySlug } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const user = getOptionalUser(event);

  // Platform admins (admin.access) resolve the full hub even for a private hub they
  // aren't a member of, so the session-230 admin community-settings override can populate.
  const community = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  return community;
});
