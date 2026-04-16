<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{ config: HomepageSectionConfig }>();

const limit = computed(() => props.config.limit ?? 3);
const { data: editorialPicks } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: { status: 'published', editorial: true, sort: 'editorial', limit },
});
</script>

<template>
  <section v-if="editorialPicks?.items?.length" class="cpub-editorial-section">
    <div class="cpub-editorial-header">
      <h2 class="cpub-editorial-heading"><i class="fa-solid fa-pen-fancy"></i> Staff Picks</h2>
    </div>
    <div class="cpub-editorial-grid" :class="{ 'cpub-editorial-single': editorialPicks.items.length === 1 }">
      <ContentCard v-for="item in editorialPicks.items" :key="item.id" :item="item" />
    </div>
  </section>
</template>

<style scoped>
.cpub-editorial-section { margin-bottom: 24px; }
.cpub-editorial-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cpub-editorial-heading { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--teal); display: flex; align-items: center; gap: 6px; }
.cpub-editorial-heading i { font-size: 10px; }
.cpub-editorial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.cpub-editorial-single { grid-template-columns: 1fr; max-width: 400px; }
@media (max-width: 768px) { .cpub-editorial-grid { grid-template-columns: 1fr; } }
</style>
