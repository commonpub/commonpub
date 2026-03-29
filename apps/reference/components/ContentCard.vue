<script setup lang="ts">
import type { Serialized, ContentListItem } from '@commonpub/server';

/**
 * ContentCard — the primary card used across homepage, search, profile, hubs.
 * Matches the project card from mockup 01-homepage:
 * - Cover image or icon placeholder with grid pattern
 * - Type + featured badges on thumbnail
 * - Difficulty dots (for projects)
 * - Title, description (2-line clamp)
 * - Author avatar + name + date row
 * - Stats: hearts, views, comments
 */
const props = defineProps<{
  item: Serialized<ContentListItem> & { isFeatured?: boolean };
}>();

const cover = computed(() => props.item.coverImageUrl);

const thumbIcons: Record<string, { icon: string; color: string }> = {
  project: { icon: 'fa-solid fa-microchip', color: 'var(--accent)' },
  article: { icon: 'fa-solid fa-file-lines', color: 'var(--teal)' },
  blog: { icon: 'fa-solid fa-pen-nib', color: 'var(--pink)' },
  explainer: { icon: 'fa-solid fa-lightbulb', color: 'var(--yellow)' },
};

const diffDots = computed(() => {
  const d = props.item.difficulty;
  if (!d) return 0;
  if (d === 'beginner') return 1;
  if (d === 'intermediate') return 2;
  return 3;
});

const isFederated = computed(() => props.item.source === 'federated');

const cardLink = computed(() => {
  if (isFederated.value && props.item.federatedContentId) {
    return `/mirror/${props.item.federatedContentId}`;
  }
  return `/${props.item.type}/${props.item.slug}`;
});

const authorInitial = computed(() => {
  const name = props.item.author?.displayName || props.item.author?.username || '?';
  return name.charAt(0).toUpperCase();
});

const dateStr = computed(() => {
  const d = props.item.publishedAt || props.item.createdAt;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});

function formatCount(n: number | undefined): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>

<template>
  <article class="cpub-cc">
    <NuxtLink :to="cardLink" class="cpub-cc-link">
      <!-- Thumbnail -->
      <div class="cpub-cc-thumb">
        <img v-if="cover" :src="cover" :alt="item.title" class="cpub-cc-cover" loading="lazy" />
        <template v-else>
          <div class="cpub-cc-grid-bg" />
          <i :class="[thumbIcons[item.type]?.icon || 'fa-solid fa-file']" class="cpub-cc-icon" :style="{ color: thumbIcons[item.type]?.color || 'var(--accent)' }" />
        </template>

        <!-- Badges overlay -->
        <div class="cpub-cc-badges">
          <span v-if="item.isFeatured" class="cpub-cc-badge cpub-cc-badge--featured">
            <i class="fa-solid fa-star"></i> Featured
          </span>
          <span v-if="isFederated && item.sourceDomain" class="cpub-cc-badge cpub-cc-badge--federated">
            <i class="fa-solid fa-globe" /> {{ item.sourceDomain }}
          </span>
          <ContentTypeBadge :type="item.type" />
        </div>

        <!-- Difficulty dots (projects only) -->
        <div v-if="diffDots > 0" class="cpub-cc-diff">
          <span v-for="i in 3" :key="i" class="cpub-cc-dot" :class="{ filled: i <= diffDots }" />
        </div>
      </div>

      <!-- Body -->
      <div class="cpub-cc-body">
        <h3 class="cpub-cc-title">{{ item.title }}</h3>
        <p v-if="item.description" class="cpub-cc-desc">{{ item.description }}</p>

        <!-- Footer: author + stats -->
        <div class="cpub-cc-footer">
          <div v-if="item.author" class="cpub-cc-author">
            <img v-if="item.author.avatarUrl" :src="item.author.avatarUrl" :alt="item.author.displayName || item.author.username" class="cpub-cc-av cpub-cc-av--img" />
            <span v-else class="cpub-cc-av">{{ authorInitial }}</span>
            <span class="cpub-cc-aname">{{ item.author.displayName || item.author.username }}</span>
            <span class="cpub-cc-sep">&middot;</span>
            <time class="cpub-cc-date">{{ dateStr }}</time>
          </div>
          <div class="cpub-cc-stats">
            <span class="cpub-cc-stat"><i class="fa-solid fa-heart"></i> {{ formatCount(item.likeCount) }}</span>
            <span class="cpub-cc-stat"><i class="fa-solid fa-eye"></i> {{ formatCount(item.viewCount) }}</span>
          </div>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
.cpub-cc {
  background: var(--surface);
  border: 2px solid var(--border);
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}

.cpub-cc:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-md);
}

.cpub-cc-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

/* Thumbnail */
.cpub-cc-thumb {
  position: relative;
  height: 150px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cpub-cc-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-cc-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.25;
}

.cpub-cc-icon {
  position: relative;
  z-index: 1;
  font-size: 36px;
  opacity: 0.2;
}

/* Badges */
.cpub-cc-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
  z-index: 2;
}

.cpub-cc-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-cc-badge--featured {
  background: var(--yellow-bg);
  border: 2px solid var(--yellow);
  color: var(--yellow);
}

.cpub-cc-badge--federated {
  background: var(--teal-bg, var(--surface2));
  border: 2px solid var(--teal);
  color: var(--teal);
}
.cpub-cc-badge--federated i {
  font-size: 8px;
}

/* Difficulty dots */
.cpub-cc-diff {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 3px;
  z-index: 2;
}

.cpub-cc-dot {
  width: 8px;
  height: 8px;
  border: 2px solid var(--surface);
  background: transparent;
}

.cpub-cc-dot.filled {
  background: var(--accent);
  border-color: var(--accent);
}

/* Body */
.cpub-cc-body {
  padding: 12px 14px 10px;
}

.cpub-cc-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 4px;
  color: var(--text);
}

.cpub-cc:hover .cpub-cc-title {
  color: var(--accent);
}

.cpub-cc-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Footer */
.cpub-cc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 2px solid var(--border2);
}

.cpub-cc-author {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-faint);
  min-width: 0;
}

.cpub-cc-av {
  width: 18px;
  height: 18px;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  color: var(--accent);
  font-size: 8px;
  font-weight: 700;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
}

.cpub-cc-av--img {
  object-fit: cover;
}

.cpub-cc-aname {
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-cc-sep {
  color: var(--border2);
}

.cpub-cc-date {
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 10px;
}

.cpub-cc-stats {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.cpub-cc-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-cc-stat i {
  font-size: 9px;
}
</style>
