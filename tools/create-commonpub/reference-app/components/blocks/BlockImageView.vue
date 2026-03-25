<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const src = computed(() => (props.content.src as string) || (props.content.url as string) || '');
const alt = computed(() => (props.content.alt as string) || '');
const caption = computed(() => (props.content.caption as string) || '');
</script>

<template>
  <figure v-if="src" class="cpub-block-image">
    <img :src="src" :alt="alt" class="cpub-image-img" loading="lazy" />
    <figcaption v-if="caption" class="cpub-image-caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.cpub-block-image {
  margin: 24px 0;
}

.cpub-image-img {
  width: 100%;
  display: block;
  border: 2px solid var(--border);
}

.cpub-image-caption {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  padding: 8px 0;
  text-align: center;
}
</style>
