<script setup lang="ts">
/**
 * Built-in section: contests — active-contests list with countdown.
 *
 * Fetches `/api/contests?limit=N`, renders sidebar-style card. Each
 * row: title (link), entry count, "Nd left" deadline, Enter CTA.
 * Mirrors legacy `ContestsSection.vue`.
 *
 * Feature-gated upstream — when `features.contests` is off the API
 * returns 404 and the section renders the empty branch.
 *
 * Non-await useFetch per session-158 pattern. `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

interface ContestItem {
  id: string;
  slug: string;
  title: string;
  entryCount?: number | null;
  endDate?: string | Date | null;
}

interface ContestsResponse {
  items?: ContestItem[];
}

interface ContestsConfig extends Record<string, unknown> {
  heading: string;
  limit: number;
}

const props = defineProps<SectionRenderProps<ContestsConfig>>();

const apiQuery = computed(() => ({
  limit: Math.min(Math.max(props.config.limit, 1), 10),
}));

const { data: contests, pending } = useFetch<ContestsResponse>(
  '/api/contests',
  {
    query: apiQuery,
    key: `section-contests:${JSON.stringify(apiQuery.value)}`,
  },
);

const items = computed(() => contests.value?.items ?? []);
const isEmpty = computed(() => !pending.value && items.value.length === 0);

function daysLeft(endDate: string | Date | null | undefined): number | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
</script>

<template>
  <section
    class="cpub-section-contests"
    :aria-labelledby="config.heading ? `section-contests-${meta.sectionId}` : undefined"
  >
    <header
      v-if="config.heading"
      class="cpub-section-contests-header"
    >
      <h2
        :id="`section-contests-${meta.sectionId}`"
        class="cpub-section-contests-heading"
      >
        {{ config.heading }}
      </h2>
      <NuxtLink to="/contests" class="cpub-section-contests-all">View all</NuxtLink>
    </header>

    <div v-if="pending" class="cpub-section-contests-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
    </div>

    <ul v-else-if="!isEmpty" class="cpub-section-contests-list">
      <li v-for="c in items" :key="c.id" class="cpub-section-contests-item">
        <NuxtLink :to="`/contests/${c.slug}`" class="cpub-section-contests-name">
          {{ c.title }}
        </NuxtLink>
        <div class="cpub-section-contests-meta">
          <span class="cpub-section-contests-entries">
            {{ c.entryCount ?? 0 }} entries
          </span>
          <span v-if="daysLeft(c.endDate) !== null" class="cpub-section-contests-deadline">
            <i class="fa-regular fa-clock" aria-hidden="true" />
            {{ daysLeft(c.endDate) }}d left
          </span>
        </div>
        <NuxtLink :to="`/contests/${c.slug}`" class="cpub-section-contests-cta">
          Enter Contest
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="cpub-section-contests-empty">No active contests.</p>
  </section>
</template>

<style scoped>
.cpub-section-contests {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
}
.cpub-section-contests-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border-soft);
  margin-bottom: var(--space-3);
}
.cpub-section-contests-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
}
.cpub-section-contests-all {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  color: var(--accent);
  text-decoration: none;
}
.cpub-section-contests-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cpub-section-contests-item {
  padding: var(--space-2) 0;
  border-bottom: var(--border-width-default) solid var(--border-soft);
}
.cpub-section-contests-item:last-child { border-bottom: none; }
.cpub-section-contests-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-1);
}
.cpub-section-contests-name:hover { color: var(--accent); }
.cpub-section-contests-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.cpub-section-contests-entries,
.cpub-section-contests-deadline {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  color: var(--text-faint);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.cpub-section-contests-cta {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--accent);
  color: var(--accent);
  text-decoration: none;
  display: inline-block;
}
.cpub-section-contests-cta:hover { background: var(--accent-bg); }
.cpub-section-contests-loading,
.cpub-section-contests-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
