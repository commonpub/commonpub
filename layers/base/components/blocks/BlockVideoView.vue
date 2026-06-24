<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const url = computed(() => (props.content.url as string) || '');
const embedUrl = computed(() => toEmbedUrl(url.value));

// Rendered-width preset (mirrors images). Missing ⇒ 'l' (760px, reading width),
// so a video doesn't stretch full-bleed and dominate the column.
type VideoSize = 's' | 'm' | 'l' | 'full';
const size = computed<VideoSize>(() => {
  const v = props.content.size;
  return v === 's' || v === 'm' || v === 'l' || v === 'full' ? v : 'l';
});

const platform = computed(() => {
  const u = url.value;
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('vimeo')) return 'Vimeo';
  return 'Video';
});
</script>

<template>
  <div v-if="embedUrl" class="cpub-block-video" :class="`cpub-video-size-${size}`">
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
  /* width:100% is required so max-width caps + margin:auto centers even inside the
     flex-column block renderer (without it, an auto-margin flex item with no
     intrinsic width shrinks to its label). */
  width: 100%;
  margin: 24px auto;
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}
/* Width presets (centered via margin:auto). Match the image-block caps. */
.cpub-video-size-s { max-width: 320px; }
.cpub-video-size-m { max-width: 540px; }
.cpub-video-size-l { max-width: 760px; }
.cpub-video-size-full { max-width: 100%; }

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
  /* Universal *,::before,::after{border-radius:var(--radius)} leak — sharp
     inner sections tile flush inside the rounded outer container on
     themes with non-zero --radius (deveco). */
  border-radius: 0;
}

.cpub-video-label i { color: var(--accent); }

.cpub-video-wrap {
  display: block;
  line-height: 0;
  border-radius: 0;
}

/* 16:9 via aspect-ratio on the iframe (not the legacy padding-bottom hack), so a
   prose `iframe { height: auto }` rule (ProjectView/ArticleView/ExplainerView)
   COOPERATES with the ratio instead of collapsing the iframe inside a 0-height
   wrap and leaving black space below it. */
.cpub-video-iframe {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  background: var(--text);
  border-radius: 0;
}
</style>
