// Content URL composable — single source of truth for content path construction

/**
 * Returns helpers for constructing content URLs in the new `/u/{username}/{type}/{slug}` format.
 *
 * Usage:
 *   const { contentPath, contentEditPath, contentNewPath } = useContentUrl();
 *   const path = contentPath('alice', 'project', 'robot-arm');  // '/u/alice/project/robot-arm'
 */
export function useContentUrl() {
  const config = useRuntimeConfig();
  const siteUrl = computed(() => config.public.siteUrl as string);

  /** Build relative path: /u/{username}/{type}/{slug} */
  function contentPath(username: string, type: string, slug: string): string {
    return `/u/${username}/${type}/${slug}`;
  }

  /** Build relative edit path: /u/{username}/{type}/{slug}/edit */
  function contentEditPath(username: string, type: string, slug: string): string {
    return `/u/${username}/${type}/${slug}/edit`;
  }

  /** Build relative create path: /u/{username}/{type}/new/edit */
  function contentNewPath(username: string, type: string): string {
    return `/u/${username}/${type}/new/edit`;
  }

  /** Build absolute URL for SEO/feeds: https://domain/u/{username}/{type}/{slug} */
  function contentUrl(username: string, type: string, slug: string): string {
    return `${siteUrl.value}/u/${username}/${type}/${slug}`;
  }

  /**
   * Build a content link from an item object (the common case in templates).
   * Handles federated content by returning the mirror path instead.
   */
  function contentLink(item: {
    type: string;
    slug: string;
    author?: { username: string } | null;
    source?: string;
    federatedContentId?: string;
  }): string {
    if (item.source === 'federated' && item.federatedContentId) {
      return `/mirror/${item.federatedContentId}`;
    }
    if (!item.author?.username) {
      // Fallback for items missing author — should not happen in practice
      return `/${item.type}/${item.slug}`;
    }
    return `/u/${item.author.username}/${item.type}/${item.slug}`;
  }

  return {
    contentPath,
    contentEditPath,
    contentNewPath,
    contentUrl,
    contentLink,
  };
}
