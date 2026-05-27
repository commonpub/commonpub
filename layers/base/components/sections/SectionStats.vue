<script setup lang="ts">
/**
 * Built-in section: stats — a numeric grid of platform totals.
 *
 * Fetches `/api/stats` (returns PlatformStats), renders 2x2 grid of
 * Projects / Posts / Members / Hubs. Hubs cell hides when the `hubs`
 * feature flag is off — same logic as the legacy `StatsSection.vue`.
 *
 * Non-await useFetch per session-158 pattern; pending state surfaced
 * via the template. SSR-friendly: useFetch includes the payload in the
 * hydration snapshot.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

// Avoid `import type { PlatformStats }` at the call site so the runtime
// stub used in component tests doesn't need to satisfy the full server
// type. Loose shape with optional + numeric primitives mirrors what the
// endpoint actually emits.
interface StatsResponse {
  content?: {
    byType?: {
      project?: number;
      blog?: number;
      article?: number;
    };
  };
  users?: { total?: number };
  hubs?: { total?: number };
}

interface StatsConfig extends Record<string, unknown> {
  heading: string;
}

const props = defineProps<SectionRenderProps<StatsConfig>>();

const features = useFeatures();
const hubsEnabled = computed(() => features.hubs.value);

const { data: stats, pending } = useFetch<StatsResponse>(
  '/api/stats',
  {
    key: `section-stats:${props.meta.sectionId}`,
    // Lazy — sidebar metric tile, not above-the-fold content. Matches the
    // legacy StatsSection.vue pattern and keeps homepage SSR fast.
    lazy: true,
  },
);

const projectCount = computed(() => stats.value?.content?.byType?.project ?? 0);
const postCount = computed(
  () => (stats.value?.content?.byType?.blog ?? 0)
       + (stats.value?.content?.byType?.article ?? 0),
);
const memberCount = computed(() => stats.value?.users?.total ?? 0);
const hubCount = computed(() => stats.value?.hubs?.total ?? 0);
</script>

<template>
  <section
    class="cpub-section-stats"
    :aria-labelledby="config.heading ? `section-stats-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-stats-${meta.sectionId}`"
      class="cpub-section-stats-heading"
    >
      {{ config.heading }}
    </h2>

    <div v-if="pending" class="cpub-section-stats-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
    </div>

    <dl v-else class="cpub-section-stats-grid" :data-with-hubs="hubsEnabled ? 'yes' : 'no'">
      <div class="cpub-section-stats-block">
        <dt>Projects</dt>
        <dd>{{ projectCount }}</dd>
      </div>
      <div class="cpub-section-stats-block">
        <dt>Posts</dt>
        <dd>{{ postCount }}</dd>
      </div>
      <div class="cpub-section-stats-block">
        <dt>Members</dt>
        <dd>{{ memberCount }}</dd>
      </div>
      <div v-if="hubsEnabled" class="cpub-section-stats-block">
        <dt>Hubs</dt>
        <dd>{{ hubCount }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.cpub-section-stats {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
}
.cpub-section-stats-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0 0 var(--space-3) 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border-soft);
}
.cpub-section-stats-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
  color: var(--text-faint);
}
.cpub-section-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin: 0;
}
.cpub-section-stats-block {
  text-align: center;
  padding: var(--space-2) 0;
}
.cpub-section-stats-block dt {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  order: 2;  /* number above label */
}
.cpub-section-stats-block dd {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text);
  margin: 0;
  order: 1;
}
</style>
