import { reorderDocsPages, getDocsSiteBySlug } from '@commonpub/server';
import { z } from 'zod';

const reorderSchema = z.object({
  pageIds: z.array(z.string().uuid()),
});

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });
  const body = await parseBody(event, reorderSchema);

  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  const version = site.versions.find((v) => v.isDefault) ?? site.versions[0];
  if (!version) throw createError({ statusCode: 404, statusMessage: 'No version found' });

  const result = await reorderDocsPages(db, version.id, user.id, body.pageIds);
  if (!result) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized' });
  }

  return { success: true };
});
