import { getDocsSiteBySlug, deleteDocsSite } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  }

  return deleteDocsSite(db, result.site.id, user.id);
});
