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

// Series data — only available when content has series metadata
const seriesPart = computed(() => props.content?.seriesPart as number | undefined);
const seriesTitle = computed(() => props.content?.seriesTitle as string | undefined);
const seriesTotalParts = computed(() => (props.content?.seriesTotalParts as number) || 0);
const hasSeries = computed(() => !!seriesTitle.value && seriesTotalParts.value > 0);
</script>

<template>
  <div class="cpub-blog-view">

    <!-- COVER IMAGE -->
    <div v-if="content.coverImageUrl" class="cpub-cover">
      <img :src="content.coverImageUrl" :alt="content.title" class="cpub-cover-img" />
    </div>

    <div class="cpub-blog-wrap">

      <!-- TYPE BADGE -->
      <div class="cpub-content-type-badge"><i class="fa-solid fa-pen-nib"></i> Blog Post</div>

      <!-- TITLE -->
      <h1 class="cpub-blog-title">{{ content.title }}</h1>

      <!-- AUTHOR ROW -->
      <div class="cpub-author-row">
        <NuxtLink v-if="content.author" :to="authorUrl" :external="isFederated" :target="isFederated ? '_blank' : undefined" style="text-decoration:none;">
          <img v-if="content.author?.avatarUrl" :src="content.author.avatarUrl" :alt="content.author?.displayName ?? content.author?.username ?? ''" class="cpub-av cpub-av-lg" style="object-fit:cover;border:2px solid var(--border);" />
          <div v-else class="cpub-av cpub-av-lg">{{ content.author?.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
        </NuxtLink>
        <div class="cpub-author-info">
          <NuxtLink v-if="content.author" :to="authorUrl" :external="isFederated" :target="isFederated ? '_blank' : undefined" class="cpub-author-name">
            {{ content.author.displayName || content.author.username }}
          </NuxtLink>
          <div class="cpub-author-meta">
            <span v-if="content.author?.username">@{{ content.author.username }}</span>
            <span class="cpub-sep">·</span>
            <span>{{ new Date(content.publishedAt || content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            <span class="cpub-sep">·</span>
            <span><i class="fa-regular fa-clock"></i> {{ content.readTime || '5 min read' }}</span>
            <template v-if="hasSeries">
              <span class="cpub-sep">·</span>
              <span class="cpub-tag cpub-tag-pink">{{ seriesTitle }} · Part {{ seriesPart || 1 }} of {{ seriesTotalParts }}</span>
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

      <!-- BLOG BODY (PROSE) -->
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
            <span class="cpub-tag cpub-tag-pink">Part {{ seriesPart || 1 }} of {{ seriesTotalParts }}</span>
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
        <div class="cpub-tags-label">Tags</div>
        <NuxtLink
          v-for="(tag, i) in content.tags"
          :key="tag.id || tag.name || i"
          :to="`/tags/${tag.slug || (tag.name || String(tag)).toLowerCase().replace(/\s+/g, '-')}`"
          class="cpub-tag"
          :class="{ 'cpub-tag-pink': i === 0 }"
        >
          {{ tag.name || tag }}
        </NuxtLink>
      </div>

      <!-- AUTHOR CARD -->
      <div v-if="content.author" class="cpub-author-card">
        <img v-if="content.author.avatarUrl" :src="content.author.avatarUrl" :alt="content.author.displayName ?? content.author.username ?? ''" class="cpub-av cpub-av-xl" style="object-fit:cover;border:2px solid var(--border);" />
        <div v-else class="cpub-av cpub-av-xl">{{ content.author.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
        <div class="cpub-author-card-info">
          <div class="cpub-author-card-label">Posted by</div>
          <div class="cpub-author-card-name">{{ content.author.displayName || content.author.username }}</div>
          <div class="cpub-author-card-handle">@{{ content.author.username }}</div>
          <div v-if="content.author.bio" class="cpub-author-card-bio">{{ content.author.bio }}</div>
          <div class="cpub-author-card-bottom">
            <span class="cpub-author-card-stat"><strong>{{ content.author.postCount ?? 0 }}</strong> posts</span>
            <span class="cpub-author-card-stat"><strong>{{ content.author.followerCount ?? 0 }}</strong> followers</span>
            <div class="cpub-author-card-actions">
              <button class="cpub-btn cpub-btn-sm"><i class="fa-solid fa-rss"></i> Follow</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ATTACHMENTS -->
      <ContentAttachments v-if="content.attachments?.length" :attachments="content.attachments" />

      <!-- COMMENTS -->
      <CommentSection :target-type="content.type" :target-id="content.id" :federated-content-id="federatedId" />

    </div>
  </div>
</template>

<style scoped>
/* ── COVER IMAGE ── */
.cpub-cover {
  width: 100%;
  max-height: 420px;
  overflow: hidden;
  border-bottom: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-cover-img {
  width: 100%;
  height: 100%;
  max-height: 420px;
  object-fit: cover;
  display: block;
}

/* ── BLOG WRAP ── */
.cpub-blog-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 80px;
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
  color: var(--green);
  border: var(--border-width-default) solid var(--border);
  background: var(--green-bg);
  padding: 3px 10px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}

/* ── TITLE ── */
.cpub-blog-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text);
  margin-bottom: 20px;
  letter-spacing: -0.01em;
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

.cpub-author-meta {
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cpub-sep { color: var(--border2); }

/* ── TAGS ── */
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

.cpub-tag-pink {
  border-color: var(--pink-border);
  color: var(--pink);
  background: var(--pink-bg);
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
  margin-bottom: 36px;
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
.cpub-eng-btn.liked { color: var(--red); border-color: var(--red); background: var(--red-bg); }
.cpub-eng-btn.bookmarked { color: var(--yellow); border-color: var(--yellow); background: var(--yellow-bg); }

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
  line-height: 1.9;
  color: var(--text-dim);
}

.cpub-prose :deep(h2) {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  margin: 40px 0 12px;
  letter-spacing: -0.01em;
}

.cpub-prose :deep(h3) {
  font-size: 15px;
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
  font-size: 12.5px;
  color: var(--teal);
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border2);
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
  gap: 7px;
}

.cpub-prose :deep(li) { color: var(--text-dim); }

.cpub-prose :deep(blockquote) {
  border-left: 4px solid var(--border2);
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

.cpub-prose :deep(blockquote.reflection) {
  border-left: 4px solid var(--purple);
  background: var(--purple-bg);
}

.cpub-prose :deep(blockquote.reflection p) {
  color: var(--purple);
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
  background: var(--pink-bg);
  border: var(--border-width-default) solid var(--pink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--pink);
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
  background: var(--pink);
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
  color: var(--pink);
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
  margin: 36px 0 28px;
  padding-top: 20px;
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
  padding: 22px;
  display: flex;
  gap: 18px;
  align-items: flex-start;
  margin: 28px 0;
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
  margin-bottom: 3px;
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
  margin-bottom: 12px;
}

.cpub-author-card-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cpub-author-card-stat {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-author-card-stat strong {
  color: var(--text-dim);
  font-weight: 600;
}

.cpub-author-card-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

/* ── BUTTONS ── */
.cpub-btn {
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 6px 14px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background var(--transition-fast);
}

.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-sm { padding: 4px 10px; font-size: 11px; }

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .cpub-blog-wrap {
    padding: 24px 16px 48px;
  }
  .cpub-engagement-row {
    flex-wrap: wrap;
  }
  .cpub-series-nav-btns {
    grid-template-columns: 1fr;
  }
  .cpub-author-card {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
