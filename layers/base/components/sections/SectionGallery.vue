<script setup lang="ts">
/**
 * Built-in section: gallery — responsive image grid.
 *
 * 2-5 columns, configurable aspect ratio, optional per-image caption +
 * click-through href. Phase 10 polish will add a lightbox via the
 * `data-lightbox-id` hook on each img.
 *
 * `var(--*)` only.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
  href: string;
}

interface GalleryConfig extends Record<string, unknown> {
  heading: string;
  columns: 2 | 3 | 4 | 5;
  aspectRatio: 'square' | '4/3' | '16/9' | '3/4' | 'auto';
  items: GalleryItem[];
}

const props = defineProps<SectionRenderProps<GalleryConfig>>();
void props;
</script>

<template>
  <section
    v-if="config.items.length > 0"
    class="cpub-section-gallery"
    :aria-labelledby="config.heading ? `section-gallery-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-gallery-${meta.sectionId}`"
      class="cpub-section-gallery-heading"
    >
      {{ config.heading }}
    </h2>

    <ul
      class="cpub-section-gallery-grid"
      :data-columns="config.columns"
    >
      <li
        v-for="(item, idx) in config.items"
        :key="idx"
        class="cpub-section-gallery-item"
        :data-aspect="config.aspectRatio"
      >
        <component
          :is="item.href ? 'a' : 'div'"
          :href="item.href || undefined"
          class="cpub-section-gallery-link"
        >
          <img
            :src="item.src"
            :alt="item.alt"
            loading="lazy"
            class="cpub-section-gallery-img"
            :data-lightbox-id="`${meta.sectionId}-${idx}`"
          />
          <figcaption v-if="item.caption" class="cpub-section-gallery-caption">
            {{ item.caption }}
          </figcaption>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cpub-section-gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-gallery-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border);
}
.cpub-section-gallery-grid {
  display: grid;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}
.cpub-section-gallery-grid[data-columns='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cpub-section-gallery-grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cpub-section-gallery-grid[data-columns='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.cpub-section-gallery-grid[data-columns='5'] { grid-template-columns: repeat(5, minmax(0, 1fr)); }

@media (max-width: 1024px) {
  .cpub-section-gallery-grid[data-columns='4'],
  .cpub-section-gallery-grid[data-columns='5'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
  .cpub-section-gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.cpub-section-gallery-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.cpub-section-gallery-link {
  display: block;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
}
.cpub-section-gallery-img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
  background: var(--surface-2);
}
.cpub-section-gallery-item[data-aspect='square']  .cpub-section-gallery-img { aspect-ratio: 1 / 1; }
.cpub-section-gallery-item[data-aspect='4/3']     .cpub-section-gallery-img { aspect-ratio: 4 / 3; }
.cpub-section-gallery-item[data-aspect='16/9']    .cpub-section-gallery-img { aspect-ratio: 16 / 9; }
.cpub-section-gallery-item[data-aspect='3/4']     .cpub-section-gallery-img { aspect-ratio: 3 / 4; }
/* auto omits aspect-ratio — image's native ratio wins */

.cpub-section-gallery-caption {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  color: var(--text-faint);
  padding-top: var(--space-1);
}
</style>
