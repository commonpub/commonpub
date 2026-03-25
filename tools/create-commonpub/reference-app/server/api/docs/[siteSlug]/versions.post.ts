import { createDocsVersion } from '@commonpub/server';
import { createDocsVersionSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });
  const input = await parseBody(event, createDocsVersionSchema);

  return createDocsVersion(db, siteSlug, user.id, input);
});
