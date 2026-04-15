<script setup lang="ts">
import type { ContentViewData } from '../../composables/useEngagement';

const props = defineProps<{
  content: ContentViewData;
  federatedId?: string;
}>();

const contentId = computed(() => props.content?.id);
const contentType = computed(() => props.content?.type ?? 'blog');
const fedId = computed(() => props.federatedId);
const { liked, bookmarked, likeCount, isFederated, toggleLike, toggleBookmark, share, fetchInitialState } = useEngagement({ contentId, contentType, federatedContentId: fedId });

onMounted(() => {
  fetchInitialState(props.content?.likeCount ?? 0);
});

const authorUrl = computed(() =>
  isFederated.value && props.content.author?.profileUrl
    ? props.content.author.profileUrl
    : `/u/${props.content.author?.username}`,
);

// Extract headings from block content for TOC
const tocHeadings = computed(() => {
  const blocks = props.content?.content;
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b: unknown) => {
      const block = b as [string, Record<string, unknown>];
      return block[0] === 'heading';
    })
    .map((b: unknown) => {
      const block = b as [string, Record<string, unknown>];
      const text = (block[1].text as string) || 'Untitled';
      // Must match BlockHeadingView's slug generation
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        id: slug,
        text,
        level: (block[1].level as number) || 2,
      };
    });
});

const { isAuthenticated } = useAuth();
const toast = useToast();
const followingAuthor = ref((props.content as unknown as Record<string, unknown>).isFollowingAuthor as boolean ?? false);

async function handleFollowAuthor(): Promise<void> {
  if (!isAuthenticated.value) {
    const { contentPath } = useContentUrl();
    await navigateTo(`/auth/login?redirect=${contentPath(props.content.author?.username ?? '', props.content.type, props.content.slug)}`);
    return;
  }
  const username = props.content.author?.username;
  if (!username) return;
  try {
    if (followingAuthor.value) {
      await $fetch(`/api/users/${username}/follow`, { method: 'DELETE' });
      followingAuthor.value = false;
    } else {
      await $fetch(`/api/users/${username}/follow`, { method: 'POST' });
      followingAuthor.value = true;
    }
  } catch {
    toast.error('Failed to update follow');
  }
}

// Series data — only available when content has series metadata
const seriesPart = computed(() => props.content?.seriesPart as number | undefined);
const seriesTitle = computed(() => props.content?.seriesTitle as string | undefined);
const seriesTotalParts = computed(() => (props.content?.seriesTotalParts as number) || 0);
const hasSeries = computed(() => !!seriesTitle.value && seriesTotalParts.value > 0);

const config = useRuntimeConfig();
useJsonLd({
  type: 'article',
  title: props.content.title,
  description: props.content.seoDescription ?? props.content.description ?? '',
  url: `${config.public.siteUrl}/u/${props.content.author?.username}/${props.content.type}/${props.content.slug}`,
  imageUrl: props.content.coverImageUrl ?? undefined,
  authorName: props.content.author?.displayName ?? props.content.author?.username ?? '',
  authorUrl: `${config.public.siteUrl}/u/${props.content.author?.username}`,
  publishedAt: props.content.publishedAt ?? props.content.createdAt,
  updatedAt: props.content.updatedAt,
});
</script>

<template>
  <div class="cpub-article-view">
    <!-- HERO BANNER (per-content bannerUrl → author bannerUrl → pattern fallback) -->
    <div class="cpub-cover">
      <img v-if="content.bannerUrl" :src="content.bannerUrl" :alt="content.title" class="cpub-cover-img" />
      <img v-else-if="content.author?.bannerUrl" :src="content.author.bannerUrl" alt="" class="cpub-cover-img" />
      <template v-else>
        <div class="cpub-cover-label">
          <i class="fa-solid fa-microchip"></i>
          cover image · 1280×720
        </div>
      </template>
    </div>

    <!-- ARTICLE CONTENT -->
    <div class="cpub-article-wrap">

      <!-- TYPE BADGE -->
      <div class="cpub-content-type-badge"><i class="fa-solid fa-pen-nib"></i> {{ content.category || 'Blog Post' }}</div>

      <!-- TITLE -->
      <h1 class="cpub-article-title">{{ content.title }}</h1>

      <!-- LEAD -->
      <p v-if="content.description" class="cpub-article-lead">{{ content.description }}</p>

      <!-- AUTHOR ROW -->
      <div class="cpub-author-row">
        <NuxtLink v-if="content.author" :to="authorUrl" :external="isFederated" :target="isFederated ? '_blank' : undefined" style="text-decoration:none;">
          <img v-if="content.author?.avatarUrl" :src="content.author.avatarUrl" :alt="content.author?.displayName ?? content.author?.username ?? ''" class="cpub-av cpub-av-lg" style="object-fit:cover;border:2px solid var(--border);" />
          <div v-else class="cpub-av cpub-av-lg">{{ content.author?.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
        </NuxtLink>
        <div class="cpub-author-info">
          <NuxtLink v-if="content.author" :to="authorUrl" :external="isFederated" :target="isFederated ? '_blank' : undefined" class="cpub-author-name">
            {{ content.author.displayName || content.author.username }}
            <i v-if="content.author.verified" class="fa-solid fa-circle-check cpub-verified" title="Verified"></i>
          </NuxtLink>
          <div class="cpub-author-meta">
            <span v-if="content.author?.username">@{{ content.author.username }}</span>
            <span class="cpub-sep">·</span>
            <span>{{ new Date(content.publishedAt || content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            <span class="cpub-sep">·</span>
            <span><i class="fa-regular fa-clock"></i> {{ content.readTime || '5 min read' }}</span>
            <template v-if="hasSeries">
              <span class="cpub-sep">·</span>
              <span class="cpub-tag cpub-tag-accent">{{ seriesTitle }} · Part {{ seriesPart || 1 }} of {{ seriesTotalParts }}</span>
            </template>
            <template v-if="content.tags?.length">
              <span class="cpub-sep">·</span>
              <NuxtLink :to="`/tags/${content.tags[0]?.slug || (content.tags[0]?.name || String(content.tags[0])).toLowerCase().replace(/\s+/g, '-')}`" class="cpub-tag cpub-tag-teal">{{ content.tags[0]?.name || content.tags[0] }}</NuxtLink>
            </template>
          </div>
        </div>
      </div>

      <!-- ENGAGEMENT ROW -->
      <div class="cpub-engagement-row">
        <div class="cpub-eng-stat"><i class="fa-regular fa-eye"></i> {{ content.viewCount?.toLocaleString() || '0' }} views</div>
        <div class="cpub-eng-sep"></div>
        <button class="cpub-eng-btn" :class="{ liked }" :aria-label="liked ? 'Unlike' : 'Like'" :aria-pressed="liked" @click="toggleLike">
          <i class="fa-solid fa-heart"></i> {{ likeCount }}
        </button>
        <button class="cpub-eng-btn" :class="{ bookmarked }" :aria-label="bookmarked ? 'Remove bookmark' : 'Bookmark'" :aria-pressed="bookmarked" @click="toggleBookmark">
          <i class="fa-solid fa-bookmark"></i> Bookmark
        </button>
        <div class="cpub-eng-spacer"></div>
        <button class="cpub-eng-btn" aria-label="Share" @click="share"><i class="fa-solid fa-share-nodes"></i> Share</button>
        <button class="cpub-eng-btn" aria-label="More options"><i class="fa-solid fa-ellipsis"></i></button>
      </div>

      <!-- ARTICLE BODY WITH TOC SIDEBAR -->
      <div v-if="tocHeadings.length > 0" class="cpub-article-body-layout">
        <aside class="cpub-article-toc-sidebar" aria-label="Table of contents">
          <TOCNav :headings="tocHeadings" />
        </aside>
      </div>

      <!-- COVER PHOTO (in-body) -->
      <div v-if="content.coverImageUrl" class="cpub-cover-photo">
        <img :src="content.coverImageUrl" :alt="content.title" class="cpub-cover-photo-img" />
      </div>

      <!-- ARTICLE BODY (PROSE) -->
      <div class="cpub-prose">
        <template v-if="content.content && Array.isArray(content.content) && (content.content as unknown[]).length > 0">
          <BlocksBlockContentRenderer :blocks="(content.content as [string, Record<string, unknown>][])" />
        </template>
        <template v-else>
          <p>No content body yet.</p>
        </template>
      </div>

      <!-- SERIES NAVIGATION -->
      <div v-if="hasSeries" class="cpub-series-nav">
        <div class="cpub-series-header">
          <div class="cpub-series-icon"><i class="fa-solid fa-layer-group"></i></div>
          <div>
            <div class="cpub-series-label">Series</div>
            <div class="cpub-series-title">{{ seriesTitle }}</div>
          </div>
          <div style="margin-left:auto;">
            <span class="cpub-tag cpub-tag-accent">Part {{ seriesPart || 1 }} of {{ seriesTotalParts }}</span>
          </div>
        </div>
        <div class="cpub-series-progress">
          <div class="cpub-series-progress-label">
            <span>Progress</span>
            <span>{{ seriesPart || 1 }} / {{ seriesTotalParts }} published</span>
          </div>
          <div class="cpub-series-progress-track">
            <div class="cpub-series-progress-fill" :style="{ width: ((seriesPart || 1) / seriesTotalParts * 100) + '%' }"></div>
          </div>
        </div>
        <div class="cpub-series-nav-btns">
          <NuxtLink v-if="content.seriesPrev" :to="content.seriesPrev.url || '#'" class="cpub-series-nav-btn cpub-prev">
            <div class="cpub-series-nav-dir"><i class="fa-solid fa-chevron-left"></i> Previous</div>
            <div class="cpub-series-nav-ep">Part {{ (seriesPart || 2) - 1 }}</div>
            <div class="cpub-series-nav-post-title">{{ content.seriesPrev.title }}</div>
          </NuxtLink>
          <div v-else class="cpub-series-nav-btn cpub-prev cpub-disabled">
            <div class="cpub-series-nav-dir"><i class="fa-solid fa-chevron-left"></i> Previous</div>
            <div class="cpub-series-nav-ep">—</div>
          </div>
          <NuxtLink v-if="content.seriesNext" :to="content.seriesNext.url || '#'" class="cpub-series-nav-btn cpub-next">
            <div class="cpub-series-nav-dir">Next <i class="fa-solid fa-chevron-right"></i></div>
            <div class="cpub-series-nav-ep">Part {{ (seriesPart || 1) + 1 }}</div>
            <div class="cpub-series-nav-post-title">{{ content.seriesNext.title }}</div>
          </NuxtLink>
          <div v-else class="cpub-series-nav-btn cpub-next cpub-disabled">
            <div class="cpub-series-nav-dir">Next <i class="fa-solid fa-chevron-right"></i></div>
            <div class="cpub-series-nav-ep">Coming soon</div>
          </div>
        </div>
      </div>

      <!-- TAGS -->
      <div v-if="content.tags?.length" class="cpub-tags-row">
        <div class="cpub-tags-label">Filed under</div>
        <NuxtLink
          v-for="(tag, i) in content.tags"
          :key="tag.id || tag.name || i"
          :to="`/tags/${tag.slug || (tag.name || String(tag)).toLowerCase().replace(/\s+/g, '-')}`"
          class="cpub-tag"
          :class="{ 'cpub-tag-accent': i === 0 }"
        >
          {{ tag.name || tag }}
        </NuxtLink>
      </div>

      <!-- AUTHOR CARD -->
      <div v-if="content.author" class="cpub-author-card">
        <img v-if="content.author.avatarUrl" :src="content.author.avatarUrl" :alt="content.author.displayName ?? content.author.username ?? ''" class="cpub-av cpub-av-xl" style="object-fit:cover;border:2px solid var(--border);" />
        <div v-else class="cpub-av cpub-av-xl">{{ content.author.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
        <div class="cpub-author-card-info">
          <div class="cpub-author-card-label">Written by</div>
          <div class="cpub-author-card-name">
            {{ content.author.displayName || content.author.username }}
            <i v-if="content.author.verified" class="fa-solid fa-circle-check cpub-verified-sm" title="Verified author"></i>
          </div>
          <div class="cpub-author-card-handle">@{{ content.author.username }}</div>
          <div v-if="content.author.bio" class="cpub-author-card-bio">{{ content.author.bio }}</div>
          <div class="cpub-author-card-footer">
            <div class="cpub-author-card-stats">
              <div class="cpub-author-card-stat"><span class="n">{{ content.author.articleCount ?? 0 }}</span><span class="l">posts</span></div>
              <div class="cpub-author-card-stat"><span class="n">{{ content.author.followerCount ?? 0 }}</span><span class="l">followers</span></div>
              <div class="cpub-author-card-stat"><span class="n">{{ content.author.totalViews ?? 0 }}</span><span class="l">total views</span></div>
            </div>
            <div class="cpub-author-card-actions">
              <button class="cpub-btn cpub-btn-sm" @click="handleFollowAuthor">
                <i :class="followingAuthor ? 'fa-solid fa-user-check' : 'fa-solid fa-rss'"></i>
                {{ followingAuthor ? 'Following' : 'Follow' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- RELATED ARTICLES -->
      <div v-if="content.related?.length" class="cpub-section-head">Related Posts</div>
      <div v-if="content.related?.length" class="cpub-related-grid">
        <NuxtLink
          v-for="item in content.related.slice(0, 3)"
          :key="item.id"
          :to="(item as any).author?.username ? `/u/${(item as any).author.username}/${item.type}/${item.slug}` : `/${item.type}/${item.slug}`"
          class="cpub-related-card"
        >
          <div class="cpub-related-card-thumb">
            <img v-if="(item as any).coverImageUrl" :src="(item as any).coverImageUrl" :alt="item.title" class="cpub-related-card-img" />
            <i v-else class="fa-solid fa-newspaper"></i>
          </div>
          <div class="cpub-related-card-body">
            <div class="cpub-related-card-type">{{ item.type }}</div>
            <div class="cpub-related-card-title">{{ item.title }}</div>
            <div class="cpub-related-card-meta">
              <span>{{ item.readTime || '5 min' }}</span>
              <span>·</span>
              <span>{{ item.viewCount?.toLocaleString() || '0' }} views</span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- ATTACHMENTS -->
      <ContentAttachments v-if="content.attachments?.length" :attachments="content.attachments" />

      <!-- COMMENTS SECTION -->
      <CommentSection :target-type="content.type" :target-id="content.id" :federated-content-id="federatedId" />

    </div>
  </div>
</template>

<style scoped>
/* ── TOC SIDEBAR ── */
.cpub-article-body-layout {
  display: none;
}
@media (min-width: 1200px) {
  .cpub-article-body-layout {
    display: block;
    position: absolute;
    left: calc(100% + 32px);
    top: 0;
    width: 200px;
  }
  .cpub-article-toc-sidebar {
    position: sticky;
    top: 80px;
  }
}

/* ── COVER IMAGE ── */
.cpub-cover {
  width: 100%;
  height: 300px;
  background: var(--accent-bg);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.25;
  pointer-events: none;
}

.cpub-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.cpub-cover-label {
  position: relative;
  z-index: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-faint);
  font-size: 11px;
  font-family: var(--font-mono);
}

.cpub-cover-label i {
  font-size: 40px;
  color: var(--accent);
  opacity: 0.4;
}

/* ── ARTICLE WRAP ── */
.cpub-article-view {
  overflow-x: clip;
}

.cpub-article-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px clamp(12px, 4vw, 24px) 80px;
  position: relative;
}

/* ── TYPE BADGE ── */
.cpub-content-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  border: var(--border-width-default) solid var(--border);
  background: var(--accent-bg);
  padding: 3px 10px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}

/* ── TITLE ── */
.cpub-article-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text);
  margin-bottom: 14px;
  letter-spacing: -0.01em;
}

/* ── LEAD ── */
.cpub-article-lead {
  font-size: 16px;
  color: var(--text-dim);
  line-height: 1.7;
  margin-bottom: 24px;
  font-weight: 400;
}

/* ── AVATARS ── */
.cpub-av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface3);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.cpub-av-lg { width: 44px; height: 44px; font-size: 14px; }
.cpub-av-xl { width: 64px; height: 64px; font-size: 18px; }

/* ── AUTHOR ROW ── */
.cpub-author-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.cpub-author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cpub-author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}

.cpub-author-name:hover { color: var(--accent); }

.cpub-verified {
  color: var(--accent);
  font-size: 10px;
}

.cpub-author-meta {
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-sep { color: var(--border2); }

/* ── TAGS (inline) ── */
.cpub-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border: var(--border-width-default) solid var(--border2);
  color: var(--text-dim);
  background: var(--surface2);
  text-decoration: none;
}
.cpub-tag:hover { color: var(--accent); border-color: var(--accent-border); }

.cpub-tag-accent {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-bg);
}

.cpub-tag-teal {
  border-color: var(--teal-border);
  color: var(--teal);
  background: var(--teal-bg);
}

/* ── ENGAGEMENT ROW ── */
.cpub-engagement-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 0;
  border-top: var(--border-width-default) solid var(--border);
  border-bottom: var(--border-width-default) solid var(--border);
  margin-bottom: 28px;
}

.cpub-eng-stat {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
}

.cpub-eng-stat i { font-size: 12px; }

.cpub-eng-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: 5px 12px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.cpub-eng-btn:hover { background: var(--surface2); color: var(--text); }
.cpub-eng-btn.liked { color: var(--red); border-color: var(--border); background: var(--red-bg); }
.cpub-eng-btn.bookmarked { color: var(--yellow); border-color: var(--border); background: var(--yellow-bg); }

.cpub-eng-sep {
  width: 2px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.cpub-eng-spacer { margin-left: auto; }

/* ── PROSE ── */
.cpub-prose {
  font-size: 15px;
  line-height: 1.85;
  color: var(--text-dim);
}

.cpub-prose :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin: 40px 0 12px;
  letter-spacing: -0.01em;
  padding-bottom: 8px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-prose :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 28px 0 8px;
}

.cpub-prose :deep(p) { margin-bottom: 18px; }
.cpub-prose :deep(strong) { color: var(--text); font-weight: 600; }
.cpub-prose :deep(em) { font-style: italic; color: var(--text-dim); }
.cpub-prose :deep(a) { color: var(--accent); text-decoration: none; }
.cpub-prose :deep(a:hover) { text-decoration: underline; }

.cpub-prose :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--teal);
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  padding: 1px 6px;
}

.cpub-prose :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.cpub-prose :deep(ul),
.cpub-prose :deep(ol) {
  margin: 0 0 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-prose :deep(li) { color: var(--text-dim); }

.cpub-prose :deep(blockquote) {
  border-left: 4px solid var(--accent);
  padding: 14px 20px;
  margin: 28px 0;
  background: var(--surface);
}

.cpub-prose :deep(blockquote p) {
  color: var(--text-dim);
  font-style: italic;
  margin: 0;
  font-size: 15px;
}

.cpub-prose :deep(hr) {
  border: none;
  border-top: var(--border-width-default) solid var(--border);
  margin: 36px 0;
}

/* ── SERIES NAV ── */
.cpub-series-nav {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: 20px;
  margin: 40px 0;
  box-shadow: var(--shadow-sm);
}

.cpub-series-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.cpub-series-icon {
  width: 28px;
  height: 28px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--accent);
  flex-shrink: 0;
}

.cpub-series-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cpub-series-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.cpub-series-progress {
  margin-bottom: 16px;
}

.cpub-series-progress-label {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
}

.cpub-series-progress-track {
  height: 4px;
  background: var(--surface3);
  overflow: hidden;
  border: var(--border-width-default) solid var(--border2);
}

.cpub-series-progress-fill {
  height: 100%;
  background: var(--accent);
}

.cpub-series-nav-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cpub-series-nav-btn {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: 12px 14px;
  cursor: pointer;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  transition: background var(--transition-fast);
}

.cpub-series-nav-btn:hover { background: var(--surface2); }
.cpub-series-nav-btn.cpub-next { text-align: right; }
.cpub-series-nav-btn.cpub-disabled { opacity: 0.5; pointer-events: none; }

.cpub-series-nav-dir {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-series-nav-btn.cpub-next .cpub-series-nav-dir { justify-content: flex-end; }

.cpub-series-nav-ep {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--accent);
}

.cpub-series-nav-post-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.35;
}

/* ── TAGS ROW ── */
.cpub-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 40px 0 32px;
  padding-top: 24px;
  border-top: var(--border-width-default) solid var(--border);
}

.cpub-tags-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  width: 100%;
  margin-bottom: 4px;
}

/* ── AUTHOR CARD ── */
.cpub-author-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: 24px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  margin: 32px 0;
  box-shadow: var(--shadow-sm);
}

.cpub-author-card-info { flex: 1; min-width: 0; }

.cpub-author-card-label {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.cpub-author-card-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-verified-sm {
  color: var(--accent);
  font-size: 12px;
}

.cpub-author-card-handle {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-bottom: 10px;
}

.cpub-author-card-bio {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.65;
  margin-bottom: 14px;
}

.cpub-author-card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cpub-author-card-stats {
  display: flex;
  gap: 20px;
}

.cpub-author-card-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cpub-author-card-stat .n {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
}

.cpub-author-card-stat .l {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-author-card-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

/* ── RELATED ARTICLES ── */
.cpub-section-head {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 48px;
}

.cpub-related-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow var(--transition-fast);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  color: inherit;
}

.cpub-related-card:hover { box-shadow: var(--shadow-md); }

.cpub-related-card-thumb {
  aspect-ratio: 16/9;
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-related-card-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.3;
}

.cpub-related-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.cpub-related-card-thumb i {
  font-size: 22px;
  color: var(--text-faint);
  position: relative;
  z-index: 1;
  opacity: 0.5;
}

.cpub-related-card-body { padding: 12px; }

.cpub-related-card-type {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--accent);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.cpub-related-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
  margin-bottom: 6px;
}

.cpub-related-card-meta {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Global overflow protection for content */
.cpub-article-wrap :deep(img),
.cpub-article-wrap :deep(video),
.cpub-article-wrap :deep(iframe) { max-width: 100%; height: auto; }
.cpub-article-wrap :deep(pre) { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.cpub-article-wrap { overflow-wrap: break-word; word-break: break-word; }

/* ── COVER PHOTO (in-body) ── */
.cpub-cover-photo {
  margin-bottom: 24px;
}
.cpub-cover-photo-img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: var(--radius, 0);
}

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .cpub-article-wrap { padding-top: 24px; padding-bottom: 48px; }
  .cpub-article-title { font-size: 22px; }
  .cpub-article-lead { font-size: 14px; margin-bottom: 16px; }
  .cpub-related-grid { grid-template-columns: 1fr 1fr; }
  .cpub-engagement-row { flex-wrap: wrap; gap: 6px; }
  .cpub-engage-btn { padding: 8px 12px; min-height: 36px; }
  .cpub-engage-sep { display: none; }
  .cpub-tag-link { padding: 4px 10px; font-size: 11px; min-height: 28px; display: inline-flex; align-items: center; }
  .cpub-series-nav-btns { grid-template-columns: 1fr; }
  .cpub-series-nav-btn { padding: 12px; min-height: 44px; }
}

@media (max-width: 480px) {
  .cpub-article-wrap { padding-top: 16px; padding-bottom: 40px; }
  .cpub-article-title { font-size: 20px; }
  .cpub-article-lead { font-size: 13px; }
  .cpub-related-grid { grid-template-columns: 1fr; }
  .cpub-author-card { flex-direction: column; gap: 12px; }
  .cpub-engage-btn { font-size: 11px; }
  .cpub-meta-row { font-size: 10px; flex-wrap: wrap; gap: 6px; }
}
</style>
