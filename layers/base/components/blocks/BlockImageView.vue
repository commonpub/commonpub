<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const src = computed(() => (props.content.src as string) || (props.content.url as string) || '');
const alt = computed(() => (props.content.alt as string) || '');
const caption = computed(() => (props.content.caption as string) || '');

/**
 * Rendered-width preset. New uploads (editor ≥ 0.7.11) carry `size` on
 * the BlockTuple content; pre-picker content (no `size` field) falls
 * back to `l` to preserve its pre-0.21.19 visual width — that's the
 * 760px cap from layer 0.21.18.
 */
type ImageSize = 's' | 'm' | 'l' | 'full';
const size = computed<ImageSize>(() => {
  const v = props.content.size;
  return v === 's' || v === 'm' || v === 'l' || v === 'full' ? v : 'l';
});
</script>

<template>
  <figure v-if="src" class="cpub-block-image" :class="`cpub-image-size-${size}`">
    <img :src="src" :alt="alt" class="cpub-image-img" loading="lazy" />
    <figcaption v-if="caption" class="cpub-image-caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
/**
 * Width preset is applied via a class on the <figure> wrapper. The image
 * itself is `width: 100%` of the wrapper, so capping the wrapper's
 * max-width caps the image. `margin-inline: auto` centers when narrower
 * than the available column. The caption sits underneath at the wrapper's
 * width so it never extends past the image.
 *
 * Aspect ratio is preserved via the image's intrinsic ratio + `height:
 * auto`. The .cpub-prose :deep(img) cap in ProjectView.vue still applies
 * but at 760px — these per-block presets stay within that envelope (the
 * 760-cap in ProjectView is the fallback when no per-block size is set).
 */
.cpub-block-image {
  margin: 24px auto;
  display: block;
}

.cpub-image-size-s { max-width: 320px; }
.cpub-image-size-m { max-width: 540px; }
.cpub-image-size-l { max-width: 760px; }
.cpub-image-size-full { max-width: 100%; }

.cpub-image-img {
  width: 100%;
  height: auto;
  display: block;
  border: var(--border-width-default) solid var(--border);
  /* Defend against the global `.cpub-prose img` rule (prose.css) leaking its
     box-shadow + margin into this scoped block when rendered inside prose. */
  box-shadow: none;
  margin: 0;
}

.cpub-image-caption {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  padding: 8px 0;
  text-align: center;
}
</style>
