import { listMembers, listRemoteMembers, getHubBySlug } from '@commonpub/server';
import type { HubMemberItem, RemoteHubMember } from '@commonpub/server';
import { z } from 'zod';

const membersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: HubMemberItem[]; total: number; remoteMembers?: RemoteHubMember[] }> => {
  const db = useDB();
  const config = useConfig();
  const { slug } = parseParams(event, { slug: 'string' });
  const query = parseQueryParams(event, membersQuerySchema);
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const result = await listMembers(db, community.id, query);

  // Include remote followers if hub federation is enabled
  if (config.features.federation && config.features.federateHubs) {
    const remoteMembers = await listRemoteMembers(db, community.id);
    return { ...result, remoteMembers };
  }

  return result;
});
