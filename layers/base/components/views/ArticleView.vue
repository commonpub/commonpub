<script setup lang="ts">
import type { ContentViewData } from '../../composables/useEngagement';

const props = defineProps<{
  content: ContentViewData;
  federatedId?: string;
}>();

const contentId = computed(() => props.content?.id);
const contentType = computed(() => props.content?.type ?? 'article');
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
    .map((b: unknown, idx: number) => {
      const block = b as [string, Record<string, unknown>];
      return {
        id: `heading-${idx}`,
        text: (block[1].text as string) || 'Untitled',
        level: (block[1].level as number) || 2,
      };
    });
});

const { isAuthenticated } = useAuth();
const toast = useToast();
const followingAuthor = ref((props.content as unknown as Record<string, unknown>).isFollowingAuthor as boolean ?? false);

async function handleFollowAuthor(): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/article/${props.content.slug}`);
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

const config = useRuntimeConfig();
useJsonLd({
  type: 'article',
  title: props.content.title,
  description: props.content.seoDescription ?? props.content.description ?? '',
  url: `${config.public.siteUrl}/article/${props.content.slug}`,
  imageUrl: props.content.coverImageUrl ?? undefined,
  authorName: props.content.author?.displayName ?? props.content.author?.username ?? '',
  authorUrl: `${config.public.siteUrl}/u/${props.content.author?.username}`,
  publishedAt: props.content.publishedAt ?? props.content.createdAt,
  updatedAt: props.content.updatedAt,
});
</script>

<template>
  <div class="cpub-article-view">
    <!-- COVER IMAGE -->
    <div class="cpub-cover">
      <img v-if="content.coverImageUrl" :src="content.coverImageUrl" :alt="content.title" class="cpub-cover-img" />
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
      <div class="cpub-content-type-badge"><i class="fa-solid fa-newspaper"></i> Article</div>

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

      <!-- ARTICLE BODY (PROSE) -->
      <div class="cpub-prose">
        <template v-if="content.content && Array.isArray(content.content) && (content.content as unknown[]).length > 0">
          <BlocksBlockContentRenderer :blocks="(content.content as [string, Record<string, unknown>][])" />
        </template>
        <template v-else>
          <p>No content body yet.</p>
        </template>
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
        <div class="cpub-av cpub-av-xl">{{ content.author.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
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
              <div class="cpub-author-card-stat"><span class="n">{{ content.author.articleCount ?? 0 }}</span><span class="l">articles</span></div>
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
      <div v-if="content.related?.length" class="cpub-section-head">Related Articles</div>
      <div v-if="content.related?.length" class="cpub-related-grid">
        <NuxtLink
          v-for="item in content.related.slice(0, 3)"
          :key="item.id"
          :to="`/${item.type}/${item.slug}`"
          class="cpub-related-card"
        >
          <div class="cpub-related-card-thumb">
            <i class="fa-solid fa-newspaper"></i>
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
.cpub-article-toc-sidebar {
  display: none;
}
@media (min-width: 1200px) {
  .cpub-article-body-layout {
    position: fixed;
    right: max(24px, calc((100vw - 720px) / 2 - 240px));
    top: 120px;
    width: 200px;
    z-index: 10;
    pointer-events: none;
  }
  .cpub-article-toc-sidebar {
    display: block;
    pointer-events: auto;
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
  border-bottom: 1px solid var(--border);
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
.cpub-article-wrap {
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
  color: var(--accent);
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border2);
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
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
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
  border: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
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
  border: 1px solid var(--border);
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
  border-top: 1px solid var(--border);
  margin: 36px 0;
}

/* ── TAGS ROW ── */
.cpub-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 40px 0 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
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
  border: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
}

.cpub-related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 48px;
}

.cpub-related-card {
  background: var(--surface);
  border: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
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

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .cpub-article-wrap {
    padding: 24px 16px 48px;
  }
  .cpub-related-grid {
    grid-template-columns: 1fr;
  }
  .cpub-engagement-row {
    flex-wrap: wrap;
  }
  .cpub-author-card {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
