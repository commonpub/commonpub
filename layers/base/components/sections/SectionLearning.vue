<script setup lang="ts">
/**
 * Built-in section: learning — grid of learning paths.
 *
 * Fetches `/api/learn?limit=N`, renders responsive card grid (title +
 * description + difficulty + duration + enrollment). Feature-gated
 * upstream on `features.learning`.
 *
 * Same shape as editorial / content-feed (paginated /api/* endpoint →
 * responsive grid) but a distinct entity type with its own metadata.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

// Loose shape — full LearningPathListItem lives in @commonpub/server
// types but the section only touches a subset. Keeping local avoids a
// transient type import that test stubs would need to satisfy.
interface LearningPathItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  estimatedHours: string | null;
  enrollmentCount: number;
  moduleCount: number;
}

interface LearningResponse {
  items?: LearningPathItem[];
}

interface LearningConfig extends Record<string, unknown> {
  heading: string;
  limit: number;
  columns: 1 | 2 | 3 | 4;
}

const props = defineProps<SectionRenderProps<LearningConfig>>();

const apiQuery = computed(() => ({
  limit: Math.min(Math.max(props.config.limit, 1), 12),
}));

const { data: paths, pending } = useFetch<LearningResponse>(
  '/api/learn',
  {
    query: apiQuery,
    key: `section-learning:${JSON.stringify(apiQuery.value)}`,
  },
);

const items = computed(() => paths.value?.items ?? []);
const isEmpty = computed(() => !pending.value && items.value.length === 0);
</script>

<template>
  <section
    class="cpub-section-learning"
    :aria-labelledby="config.heading ? `section-learning-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-learning-${meta.sectionId}`"
      class="cpub-section-learning-heading"
    >
      {{ config.heading }}
    </h2>

    <div v-if="pending" class="cpub-section-learning-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
      <span>Loading…</span>
    </div>

    <ul
      v-else-if="!isEmpty"
      class="cpub-section-learning-grid"
      :data-columns="config.columns"
    >
      <li v-for="path in items" :key="path.id" class="cpub-section-learning-card">
        <NuxtLink :to="`/learn/${path.slug}`" class="cpub-section-learning-link">
          <!--
            Using <img> rather than background-image: (a) Vue auto-escapes
            attribute bindings so a path.coverImageUrl containing `");
            evil(` can't escape the url(...) context (modern browsers
            ignore JS in CSS URLs but still, defence in depth), and (b)
            the cover IS semantically information when present, so giving
            it an `alt` of the path title is better a11y than `role=
            presentation`. Empty alt would also be fine here; the title
            text directly follows.
          -->
          <img
            v-if="path.coverImageUrl"
            :src="path.coverImageUrl"
            :alt="''"
            loading="lazy"
            class="cpub-section-learning-cover"
          />
          <div class="cpub-section-learning-body">
            <h3 class="cpub-section-learning-title">{{ path.title }}</h3>
            <p v-if="path.description" class="cpub-section-learning-desc">
              {{ path.description }}
            </p>
            <div class="cpub-section-learning-meta">
              <span v-if="path.difficulty" class="cpub-section-learning-chip">
                {{ path.difficulty }}
              </span>
              <span v-if="path.estimatedHours" class="cpub-section-learning-chip">
                <i class="fa-regular fa-clock" aria-hidden="true" />
                {{ path.estimatedHours }}h
              </span>
              <span class="cpub-section-learning-chip">
                {{ path.enrollmentCount }} enrolled
              </span>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="cpub-section-learning-empty">No learning paths yet.</p>
  </section>
</template>

<style scoped>
.cpub-section-learning {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-learning-heading {
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
.cpub-section-learning-grid {
  display: grid;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}
.cpub-section-learning-grid[data-columns='1'] { grid-template-columns: 1fr; }
.cpub-section-learning-grid[data-columns='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cpub-section-learning-grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cpub-section-learning-grid[data-columns='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }

@media (max-width: 1024px) {
  .cpub-section-learning-grid[data-columns='3'],
  .cpub-section-learning-grid[data-columns='4'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .cpub-section-learning-grid { grid-template-columns: 1fr; }
}

.cpub-section-learning-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
}
.cpub-section-learning-link {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}
.cpub-section-learning-cover {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background-color: var(--surface-2);
}
.cpub-section-learning-body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.cpub-section-learning-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.cpub-section-learning-link:hover .cpub-section-learning-title { color: var(--accent); }
.cpub-section-learning-desc {
  font-size: var(--text-sm);
  color: var(--text-soft);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cpub-section-learning-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.cpub-section-learning-chip {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--border-soft);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.cpub-section-learning-loading,
.cpub-section-learning-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
