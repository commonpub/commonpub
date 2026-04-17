import { listContent } from '@commonpub/server';
import type { PaginatedResponse, ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';

// Statuses a non-owner may request. Any other value (draft, scheduled, deleted,
// etc.) is coerced to 'published' — the old behavior passed the filter through
// verbatim, so /api/content?status=draft leaked every user's drafts.
const PUBLIC_STATUSES = new Set(['published', 'archived']);

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContentListItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = parseQueryParams(event, contentFiltersSchema);

  const isOwnContent = filters.authorId && user?.id === filters.authorId;

  const config = useConfig();

  const resolvedStatus = isOwnContent
    ? filters.status
    : (filters.status && PUBLIC_STATUSES.has(filters.status) ? filters.status : 'published');

  return listContent(db, {
    ...filters,
    status: resolvedStatus,
    // Only show public content unless viewing own content
    visibility: isOwnContent ? filters.visibility : 'public',
  }, {
    includeFederated: config.features.seamlessFederation,
    allowedContentTypes: config.instance.contentTypes,
  });
});
