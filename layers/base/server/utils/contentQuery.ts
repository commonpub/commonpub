import type { H3Event } from 'h3';
import type { ContentFilters } from '@commonpub/schema';

// Statuses a non-owner may request. Any other value (draft, scheduled, deleted, etc.)
// is coerced to 'published' — passing the filter through verbatim would leak drafts
// (/api/content?status=draft once leaked every user's drafts).
const PUBLIC_STATUSES = new Set(['published', 'archived']);

/**
 * Resolve a raw ContentFilters query into the SAFE filters + server options shared by
 * BOTH content list endpoints (offset `index.get.ts` and keyset `feed.get.ts`). Centralises
 * the auth/status/visibility gate + the federation/content-type options so the two endpoints
 * can't drift on security: a non-owner only ever sees published+public content.
 */
export function resolveContentQuery(
  event: H3Event,
  filters: ContentFilters,
): { filters: ContentFilters; options: { includeFederated: boolean; allowedContentTypes?: string[] } } {
  const user = getOptionalUser(event);
  const config = useConfig();

  const isOwnContent = !!filters.authorId && user?.id === filters.authorId;

  const resolvedStatus = isOwnContent
    ? filters.status
    : (filters.status && PUBLIC_STATUSES.has(filters.status) ? filters.status : 'published');

  return {
    filters: {
      ...filters,
      status: resolvedStatus,
      // Only show public content unless viewing own content.
      visibility: isOwnContent ? filters.visibility : 'public',
    },
    options: {
      includeFederated: config.features.seamlessFederation,
      allowedContentTypes: config.instance.contentTypes,
    },
  };
}
