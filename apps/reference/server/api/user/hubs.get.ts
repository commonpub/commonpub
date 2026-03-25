import { eq } from 'drizzle-orm';
import { hubs, hubMembers } from '@commonpub/schema';

/** GET /api/user/hubs — List hubs the current user is a member of */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();

  const rows = await db
    .select({
      id: hubs.id,
      name: hubs.name,
      slug: hubs.slug,
      iconUrl: hubs.iconUrl,
      role: hubMembers.role,
    })
    .from(hubMembers)
    .innerJoin(hubs, eq(hubMembers.hubId, hubs.id))
    .where(eq(hubMembers.userId, user.id));

  return { items: rows };
});
