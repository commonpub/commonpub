import type { ContentViewData } from './useEngagement';

/**
 * Transforms federated content API response into ContentViewData for view components.
 * Handles block content parsing, metadata extraction, and actor profile mapping.
 */
export function useMirrorContent(fedContent: Ref<Record<string, unknown> | null>) {
  const contentType = computed(() => {
    const t = (fedContent.value?.cpubType as string) || (fedContent.value?.apType as string)?.toLowerCase() || 'article';
    return t;
  });

  const actor = computed(() => fedContent.value?.actor as Record<string, unknown> | null);

  const transformedContent = computed<ContentViewData | null>(() => {
    const fc = fedContent.value;
    if (!fc) return null;

    const title = (fc.title as string) || 'Untitled';

    // Parse block content: may be BlockTuple JSON or raw HTML from federation
    let content: unknown = fc.content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed.startsWith('[[') || trimmed.startsWith('[["')) {
        try { content = JSON.parse(trimmed); } catch { /* keep as string */ }
      }
      // If still a string (HTML from federation), wrap as BlockTuple array
      if (typeof content === 'string' && content.trim()) {
        content = [['paragraph', { html: content }]];
      }
    }

    // Extract CommonPub metadata (difficulty, cost, parts) if available
    const meta = (fc.cpubMetadata as Record<string, unknown>) || null;

    return {
      id: fc.id as string,
      type: contentType.value,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      subtitle: null,
      description: (fc.summary as string) || null,
      content,
      coverImageUrl: (fc.coverImageUrl as string) || null,
      category: null,
      difficulty: (meta?.difficulty as string) || null,
      buildTime: (meta?.buildTime as string) || null,
      estimatedCost: (meta?.estimatedCost as string) || null,
      status: 'published',
      visibility: 'public',
      isFeatured: false,
      seoDescription: null,
      previewToken: null,
      parts: Array.isArray(meta?.parts) ? meta.parts as ContentViewData['parts'] : null,
      sections: null,
      viewCount: 0,
      likeCount: (fc.localLikeCount as number) ?? 0,
      commentCount: (fc.localCommentCount as number) ?? 0,
      forkCount: 0,
      publishedAt: (fc.publishedAt as string) || null,
      createdAt: (fc.receivedAt as string) || new Date().toISOString(),
      updatedAt: (fc.receivedAt as string) || new Date().toISOString(),
      licenseType: null,
      series: null,
      estimatedMinutes: null,
      tags: Array.isArray(fc.tags) ? (fc.tags as Array<{ type: string; name: string }>).map(t => ({ id: '', name: t.name, slug: t.name.toLowerCase().replace(/\s+/g, '-') })) : [],
      author: {
        id: '',
        username: (actor.value?.preferredUsername as string) || 'unknown',
        displayName: (actor.value?.displayName as string) || (actor.value?.preferredUsername as string) || 'Unknown',
        avatarUrl: (actor.value?.avatarUrl as string) || null,
      },
      buildCount: 0,
      bookmarkCount: 0,
    } satisfies ContentViewData;
  });

  const originDomain = computed(() => (fedContent.value?.originDomain as string) || 'unknown');
  const originUrl = computed(() => (fedContent.value?.url as string) || null);
  const authorHandle = computed(() => {
    if (!actor.value) return '';
    return `@${actor.value.preferredUsername ?? 'unknown'}@${actor.value.instanceDomain ?? ''}`;
  });

  return {
    contentType,
    actor,
    transformedContent,
    originDomain,
    originUrl,
    authorHandle,
  };
}
