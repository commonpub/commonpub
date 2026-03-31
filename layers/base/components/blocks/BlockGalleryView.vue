<script setup lang="ts">
interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

const props = defineProps<{ content: Record<string, unknown> }>();

const images = computed<GalleryImage[]>(() => {
  const raw = props.content.images;
  if (!Array.isArray(raw)) return [];
  return raw as GalleryImage[];
});
</script>

<template>
  <div v-if="images.length > 0" class="cpub-block-gallery">
    <div class="cpub-gallery-grid">
      <figure v-for="(img, idx) in images" :key="idx" class="cpub-gallery-item">
        <img :src="img.src" :alt="img.alt" class="cpub-gallery-img" loading="lazy" />
        <figcaption v-if="img.caption" class="cpub-gallery-caption">{{ img.caption }}</figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-gallery {
  margin: 24px 0;
}

.cpub-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.cpub-gallery-item {
  margin: 0;
}

.cpub-gallery-img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
  border: 2px solid var(--border);
}

.cpub-gallery-caption {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  padding: 4px 0;
}
</style>
