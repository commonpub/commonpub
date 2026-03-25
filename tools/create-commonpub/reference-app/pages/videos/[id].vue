<script setup lang="ts">
const route = useRoute();
const videoId = computed(() => route.params.id as string);

// Video API may return enriched data beyond the base VideoDetail type
const { data: video } = useLazyFetch<any>(() => `/api/videos/${videoId.value}`);

useSeoMeta({
  title: () => video.value?.title ? `${video.value.title} — CommonPub` : 'Video — CommonPub',
  description: () => video.value?.description ?? '',
});

// Track view — GET already handles view counting server-side
// No separate POST needed (the server route increments viewCount on GET)

function buildEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

const videoEmbedUrl = computed(() => {
  const url = video.value?.embedUrl || video.value?.url;
  return url ? buildEmbedUrl(url) : null;
});

const categoryName = computed(() => {
  const cat = video.value?.category;
  if (!cat) return null;
  return typeof cat === 'string' ? cat : cat.name;
});

const authorInitial = computed(() => {
  const a = video.value?.author;
  return (a?.displayName || a?.username || 'U').charAt(0).toUpperCase();
});
</script>

<template>
  <div v-if="video" class="cpub-video-page">
    <!-- Video player -->
    <div class="cpub-video-player">
      <iframe
        v-if="videoEmbedUrl"
        :src="videoEmbedUrl"
        class="cpub-video-iframe"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        :title="video.title || 'Video'"
      />
      <div v-else class="cpub-video-placeholder">
        <i class="fa-solid fa-play"></i>
        <p>Video preview not available</p>
        <a v-if="video.url" :href="video.url" target="_blank" rel="noopener" class="cpub-link">Open video link</a>
      </div>
    </div>

    <!-- Video info -->
    <div class="cpub-video-info">
      <h1 class="cpub-video-title">{{ video.title }}</h1>
      <div class="cpub-video-meta">
        <span v-if="categoryName"><i class="fa-solid fa-tag"></i> {{ categoryName }}</span>
        <span><i class="fa-regular fa-eye"></i> {{ (video.viewCount ?? 0).toLocaleString() }} views</span>
        <span v-if="video.duration"><i class="fa-regular fa-clock"></i> {{ video.duration }}</span>
        <span v-if="video.createdAt">{{ new Date(video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
      </div>
      <p v-if="video.description" class="cpub-video-desc">{{ video.description }}</p>

      <!-- Author -->
      <div v-if="video.author" class="cpub-video-author">
        <div class="cpub-video-author-av">{{ authorInitial }}</div>
        <div>
          <NuxtLink
            v-if="video.author.username"
            :to="`/u/${video.author.username}`"
            class="cpub-video-author-name"
          >
            {{ video.author.displayName ?? video.author.username }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="cpub-empty-state" style="padding: 64px">
    <p class="cpub-empty-state-title">Video not found</p>
  </div>
</template>

<style scoped>
.cpub-video-page {
  max-width: 960px;
}

.cpub-video-player {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--text);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
  margin-bottom: 20px;
  overflow: hidden;
}

.cpub-video-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.cpub-video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--surface3);
}

.cpub-video-placeholder i {
  font-size: 48px;
}

.cpub-video-placeholder p {
  font-size: 13px;
}

.cpub-video-info {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 20px;
}

.cpub-video-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}

.cpub-video-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-bottom: 14px;
}

.cpub-video-meta i {
  margin-right: 4px;
}

.cpub-video-desc {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.7;
  margin-bottom: 20px;
}

.cpub-video-author {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 2px solid var(--border);
}

.cpub-video-author-av {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
}

.cpub-video-author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}

.cpub-video-author-name:hover {
  color: var(--accent);
}

.cpub-link {
  color: var(--accent);
  text-decoration: none;
}

.cpub-link:hover {
  text-decoration: underline;
}
</style>
