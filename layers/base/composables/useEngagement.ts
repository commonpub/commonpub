/**
 * Reusable composable for content engagement actions (like, bookmark, share).
 * Handles optimistic updates with rollback on API failure.
 */
export interface ContentViewData {
  id: string;
  type: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  content: unknown;
  coverImageUrl: string | null;
  category: string | null;
  difficulty: string | null;
  buildTime: string | null;
  estimatedCost: string | null;
  status: string;
  visibility: string;
  isFeatured: boolean;
  seoDescription: string | null;
  previewToken: string | null;
  parts: Array<{
    id: string;
    name: string;
    description?: string;
    quantity: number;
    url?: string;
    price?: number;
    currency?: string;
    category?: string;
    required: boolean;
    productId?: string;
  }> | null;
  sections: Array<{
    id: string;
    title: string;
    anchor: string;
    type: string;
    content?: unknown;
  }> | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  forkCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  licenseType: string | null;
  series: string | null;
  estimatedMinutes: number | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    /** Remote actor URI — set for federated content, used as external profile link */
    profileUrl?: string | null;
    bio?: string | null;
    headline?: string | null;
    verified?: boolean;
    org?: string;
    articleCount?: number;
    followerCount?: number;
    totalViews?: number;
    postCount?: number;
  };
  // Optional fields that may come from enriched responses
  readTime?: string;
  buildCount?: number;
  bookmarkCount?: number;
  githubUrl?: string;
  license?: string;
  hardwarePrimary?: string;
  hardwareSecondary?: string;
  hardwareTertiary?: string;
  community?: { name: string; slug: string; description: string | null };
  related?: Array<{ id: string; type: string; slug: string; title: string; readTime?: string; viewCount?: number }>;
  seriesPart?: number;
  seriesTitle?: string;
  seriesTotalParts?: number;
  seriesPrev?: { title: string; url: string };
  seriesNext?: { title: string; url: string };
}

export interface EngagementOptions {
  contentId: Ref<string | undefined>;
  contentType: Ref<string>;
  /** When set, likes federate to the remote instance instead of acting locally */
  federatedContentId?: Ref<string | undefined>;
}

export function useEngagement(opts: EngagementOptions) {
  const { contentId, contentType, federatedContentId } = opts;
  const liked = ref(false);
  const bookmarked = ref(false);
  const likeCount = ref(0);

  const isFederated = computed(() => !!federatedContentId?.value);

  function setInitialState(isLiked: boolean, isBookmarked: boolean, likes: number): void {
    liked.value = isLiked;
    bookmarked.value = isBookmarked;
    likeCount.value = likes;
  }

  async function toggleLike(): Promise<void> {
    if (!contentId.value) return;
    const prev = liked.value;
    const prevCount = likeCount.value;
    liked.value = !liked.value;
    likeCount.value += liked.value ? 1 : -1;

    try {
      if (isFederated.value) {
        await $fetch('/api/federation/like', {
          method: 'POST',
          body: { federatedContentId: federatedContentId!.value },
        });
      } else {
        await $fetch('/api/social/like', {
          method: 'POST',
          body: { targetType: contentType.value, targetId: contentId.value },
        });
      }
    } catch {
      liked.value = prev;
      likeCount.value = prevCount;
    }
  }

  async function toggleBookmark(): Promise<void> {
    if (!contentId.value) return;
    const prev = bookmarked.value;
    bookmarked.value = !bookmarked.value;

    try {
      await $fetch('/api/social/bookmark', {
        method: 'POST',
        body: { targetType: contentType.value, targetId: contentId.value },
      });
    } catch {
      bookmarked.value = prev;
    }
  }

  async function share(): Promise<void> {
    if (!contentId.value) return;
    if (navigator.share) {
      try {
        await navigator.share({
          url: window.location.href,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  /** Fetch actual liked/bookmarked state from server (call onMounted) */
  async function fetchInitialState(likes: number): Promise<void> {
    likeCount.value = likes;
    if (!contentId.value) return;
    try {
      if (isFederated.value) {
        // Federated: likes are tracked via AP (no local like record), but bookmarks are local
        const bmRes = await $fetch<{ bookmarked: boolean }>('/api/social/bookmark', {
          params: { targetType: contentType.value, targetId: contentId.value },
        }).catch(() => ({ bookmarked: false }));
        bookmarked.value = bmRes.bookmarked;
      } else {
        const [likeRes, bmRes] = await Promise.all([
          $fetch<{ liked: boolean }>('/api/social/like', {
            params: { targetType: contentType.value, targetId: contentId.value },
          }).catch(() => ({ liked: false })),
          $fetch<{ bookmarked: boolean }>('/api/social/bookmark', {
            params: { targetType: contentType.value, targetId: contentId.value },
          }).catch(() => ({ bookmarked: false })),
        ]);
        liked.value = likeRes.liked;
        bookmarked.value = bmRes.bookmarked;
      }
    } catch {
      // Non-critical — default to false
    }
  }

  return {
    liked,
    bookmarked,
    likeCount,
    isFederated,
    setInitialState,
    fetchInitialState,
    toggleLike,
    toggleBookmark,
    share,
  };
}
