<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const embedUrl = computed(() => toEmbedUrl(props.content.url as string));

type EmbedSize = 's' | 'm' | 'l' | 'full';
const size = computed<EmbedSize>(() => {
  const v = props.content.size;
  return v === 's' || v === 'm' || v === 'l' || v === 'full' ? v : 'l';
});
</script>

<template>
  <div v-if="embedUrl" class="cpub-block-embed" :class="`cpub-embed-size-${size}`">
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
  /* width:100% so max-width caps + margin:auto centers in the flex-column renderer. */
  width: 100%;
  margin: 24px auto;
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}
.cpub-embed-size-s { max-width: 320px; }
.cpub-embed-size-m { max-width: 540px; }
.cpub-embed-size-l { max-width: 760px; }
.cpub-embed-size-full { max-width: 100%; }

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
  /* Universal *,::before,::after{border-radius:var(--radius)} leak — see
     BlockCodeView for the pattern. */
  border-radius: 0;
}

.cpub-embed-label i { color: var(--accent); }

.cpub-embed-wrap {
  display: block;
  line-height: 0;
  border-radius: 0;
}

/* 16:9 via aspect-ratio so a prose `iframe { height: auto }` rule cooperates with
   the ratio rather than collapsing the iframe (see BlockVideoView). */
.cpub-embed-iframe {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  background: var(--text);
  border-radius: 0;
}
</style>
