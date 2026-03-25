import { listMembers, getHubBySlug } from '@commonpub/server';
import type { HubMemberItem } from '@commonpub/server';
import { z } from 'zod';

const membersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: HubMemberItem[]; total: number }> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const query = parseQueryParams(event, membersQuerySchema);
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return listMembers(db, community.id, query);
});
