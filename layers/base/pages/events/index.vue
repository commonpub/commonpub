<script setup lang="ts">
import type { EventListItem } from '@commonpub/server';

useSeoMeta({ title: `Events — ${useSiteName()}` });

const { isAuthenticated } = useAuth();
const { data } = await useFetch<{ items: EventListItem[]; total: number }>('/api/events');
</script>

<template>
  <div class="cpub-events-page">
    <div class="cpub-events-header">
      <SectionHeader title="Events" large />
      <NuxtLink v-if="isAuthenticated" to="/events/create" class="cpub-btn-create">
        <i class="fa-solid fa-plus"></i> Create Event
      </NuxtLink>
    </div>

    <div v-if="data?.items?.length" class="cpub-events-grid">
      <EventCard v-for="event in data.items" :key="event.id" :event="event" />
    </div>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-calendar-days"></i></div>
      <p class="cpub-empty-state-title">No events yet</p>
      <p class="cpub-empty-state-desc">Check back soon for upcoming events.</p>
    </div>
  </div>
</template>

<style scoped>
.cpub-events-page { max-width: 960px; margin: 0 auto; padding: 32px; }
.cpub-events-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.cpub-btn-create {
  font-size: 12px; padding: 6px 14px; background: var(--accent); color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--border); text-decoration: none;
  display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);
  transition: all 0.15s;
}
.cpub-btn-create:hover { box-shadow: var(--shadow-md); transform: translate(-1px, -1px); }

.cpub-events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

@media (max-width: 768px) {
  .cpub-events-page { padding: 16px; }
  .cpub-events-grid { grid-template-columns: 1fr; }
}
</style>
