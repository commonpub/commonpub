<script setup lang="ts">
defineProps<{
  video: {
    id: string;
    title: string;
    thumbnailUrl?: string | null;
    duration?: number | null;
    viewCount: number;
    authorId: string;
  };
}>();

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <div class="cpub-video-card cpub-card">
    <div class="cpub-video-thumb">
      <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" :alt="video.title" loading="lazy" />
      <div v-else class="cpub-video-thumb-placeholder">
        <i class="fa-solid fa-play"></i>
      </div>
      <span v-if="video.duration" class="cpub-video-duration">{{ formatDuration(video.duration) }}</span>
    </div>
    <div class="cpub-card-body">
      <h3 class="cpub-video-title">{{ video.title }}</h3>
      <div class="cpub-video-meta">
        <span><i class="fa-solid fa-eye"></i> {{ video.viewCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-video-thumb {
  position: relative;
  height: 140px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
  overflow: hidden;
}

.cpub-video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-video-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 24px;
  color: var(--text-faint);
  opacity: 0.3;
}

.cpub-video-duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: var(--color-surface-overlay);
  color: var(--color-text-inverse);
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 6px;
}

.cpub-video-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  line-height: 1.35;
}

.cpub-video-meta {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  display: flex;
  gap: 8px;
}
</style>
