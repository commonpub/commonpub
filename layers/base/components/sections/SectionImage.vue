<script setup lang="ts">
/**
 * Built-in section: image — single image with optional caption + link.
 *
 * Phase 1c starter. Author-provided `src` is rendered as-is; aspect-ratio
 * keeps cards uniform. Lazy-loaded by default for below-fold sections.
 *
 * Phase 3e inspector will swap the `src` text input for an ImageUpload
 * picker via `.describe('image')` Zod metadata.
 *
 * `var(--*)` only.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface ImageConfig extends Record<string, unknown> {
  src: string;
  alt: string;
  caption: string;
  href: string;
  fit: 'contain' | 'cover';
  aspectRatio: '16/9' | '4/3' | '1/1' | 'auto';
}

defineProps<SectionRenderProps<ImageConfig>>();
</script>

<template>
  <figure
    class="cpub-section-image"
    :data-aspect="config.aspectRatio"
    :data-fit="config.fit"
  >
    <!-- The `href` field is optional — link only when truthy so screen
         readers don't announce a non-interactive image as a link. -->
    <component
      :is="config.href ? 'a' : 'div'"
      :href="config.href || undefined"
      class="cpub-section-image-frame"
    >
      <img
        v-if="config.src"
        :src="config.src"
        :alt="config.alt"
        loading="lazy"
        decoding="async"
        class="cpub-section-image-img"
      />
      <div v-else class="cpub-section-image-placeholder" aria-hidden="true">
        <i class="fa-regular fa-image" />
      </div>
    </component>
    <figcaption v-if="config.caption" class="cpub-section-image-caption">
      {{ config.caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.cpub-section-image {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.cpub-section-image-frame {
  display: block;
  width: 100%;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
}
.cpub-section-image[data-aspect='16/9'] .cpub-section-image-frame { aspect-ratio: 16 / 9; }
.cpub-section-image[data-aspect='4/3']  .cpub-section-image-frame { aspect-ratio: 4 / 3; }
.cpub-section-image[data-aspect='1/1']  .cpub-section-image-frame { aspect-ratio: 1 / 1; }

.cpub-section-image-img {
  width: 100%;
  height: 100%;
  display: block;
}
.cpub-section-image[data-fit='cover']   .cpub-section-image-img { object-fit: cover; }
.cpub-section-image[data-fit='contain'] .cpub-section-image-img { object-fit: contain; }
/* Aspect=auto + no explicit ratio: let the image dictate height */
.cpub-section-image[data-aspect='auto'] .cpub-section-image-img {
  height: auto;
}

.cpub-section-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  color: var(--text-faint);
  font-size: var(--text-xl);
}
.cpub-section-image-caption {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: 1.5;
}
</style>
