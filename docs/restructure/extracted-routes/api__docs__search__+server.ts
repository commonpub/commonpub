import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchDocsPages, getDocsSiteBySlug } from '$lib/server/docs';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }

  const query = url.searchParams.get('q') ?? '';
  const siteSlug = url.searchParams.get('siteSlug') ?? '';
  const versionId = url.searchParams.get('versionId') ?? '';

  if (!query.trim() || !siteSlug) {
    return json([]);
  }

  const siteResult = await getDocsSiteBySlug(locals.db, siteSlug);
  if (!siteResult) {
    return json([]);
  }

  // Use provided versionId or default version
  let activeVersionId = versionId;
  if (!activeVersionId) {
    const defaultVersion =
      siteResult.versions.find((v) => v.isDefault === 1) ?? siteResult.versions[0];
    if (!defaultVersion) return json([]);
    activeVersionId = defaultVersion.id;
  }

  const results = await searchDocsPages(locals.db, siteResult.site.id, activeVersionId, query);
  return json(results);
};
