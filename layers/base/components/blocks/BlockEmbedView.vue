<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

// Translate common watch-page URLs into iframe-embeddable equivalents
// so authors who paste a YouTube/Vimeo URL into the generic Embed block
// don't end up with an iframe that the provider refuses to render
// (X-Frame-Options / CSP frame-ancestors). Mirrors BlockVideoView.
const embedUrl = computed(() => {
  const raw = (props.content.url as string) || '';
  if (!raw) return '';
  const yt = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  // Anything else: allow http(s) only (block javascript:, data:, etc.).
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
  return '';
});
</script>

<template>
  <div v-if="embedUrl" class="cpub-block-embed">
    <div class="cpub-embed-label">
      <i class="fa-solid fa-globe"></i> Embed
    </div>
    <div class="cpub-embed-wrap">
      <iframe :src="embedUrl" class="cpub-embed-iframe" frameborder="0" loading="lazy" title="Embedded content" />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-embed {
  margin: 24px 0;
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.cpub-embed-label {
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

.cpub-embed-label i { color: var(--accent); }

.cpub-embed-wrap {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
}

.cpub-embed-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
