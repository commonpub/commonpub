<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const url = computed(() => (props.content.url as string) || '');
const embedUrl = computed(() => toEmbedUrl(url.value));

const platform = computed(() => {
  const u = url.value;
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('vimeo')) return 'Vimeo';
  return 'Video';
});
</script>

<template>
  <div v-if="embedUrl" class="cpub-block-video">
    <div class="cpub-video-label">
      <i class="fa-solid fa-film"></i> {{ platform }}
    </div>
    <div class="cpub-video-wrap">
      <iframe
        :src="embedUrl"
        class="cpub-video-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        :title="`${platform} video`"
      />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-video {
  margin: 24px 0;
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.cpub-video-label {
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-video-label i { color: var(--accent); }

.cpub-video-wrap {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  background: var(--text);
}

.cpub-video-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
