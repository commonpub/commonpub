<script setup lang="ts">
/**
 * ContestMediaStrip — the banner + cover image placeholders shown ABOVE the
 * contest body canvas, mirroring the project/blog editors where the images are
 * visual placeholders rather than fields buried in a settings section. A thin
 * wrapper over two themed ImageUpload zones; v-models bannerUrl + coverImageUrl
 * back to the editor model so the organizer sees where each image appears.
 */
defineProps<{ bannerUrl: string; coverImageUrl: string }>();
const emit = defineEmits<{
  'update:bannerUrl': [url: string];
  'update:coverImageUrl': [url: string];
}>();
</script>

<template>
  <div class="cpub-contest-media">
    <div class="cpub-contest-media-banner">
      <ImageUpload
        :model-value="bannerUrl"
        purpose="banner"
        label="Banner Image"
        hint="Wide hero image across the top of the contest page (~4:1)."
        @update:model-value="emit('update:bannerUrl', $event)"
      />
    </div>
    <div class="cpub-contest-media-cover">
      <ImageUpload
        :model-value="coverImageUrl"
        purpose="cover"
        label="Cover Image (optional)"
        hint="Card/thumbnail image shown in listings (~4:3). Falls back to the banner if unset."
        @update:model-value="emit('update:coverImageUrl', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Banner spans the canvas width (it is the hero); the cover sits beside it as the
   smaller listing thumbnail. Stacks on narrow viewports. */
.cpub-contest-media { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: var(--space-3); align-items: start; }
.cpub-contest-media-banner, .cpub-contest-media-cover { min-width: 0; }
@media (max-width: 768px) {
  .cpub-contest-media { grid-template-columns: 1fr; }
}
</style>
