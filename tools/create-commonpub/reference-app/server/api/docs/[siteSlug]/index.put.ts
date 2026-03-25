import { getDocsSiteBySlug, updateDocsSite } from '@commonpub/server';
import { updateDocsSiteSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });
  const input = await parseBody(event, updateDocsSiteSchema);

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  }

  const updated = await updateDocsSite(db, result.site.id, user.id, input);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to update this docs site' });
  }
  return updated;
});
