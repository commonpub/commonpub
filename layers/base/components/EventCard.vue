<script setup lang="ts">
import type { EventListItem } from '@commonpub/server';

const props = defineProps<{
  event: EventListItem;
}>();

const statusClass = computed(() => {
  const map: Record<string, string> = {
    published: 'cpub-badge-accent',
    active: 'cpub-badge-green',
    completed: 'cpub-badge-dim',
    cancelled: 'cpub-badge-red',
    draft: 'cpub-badge-yellow',
  };
  return map[props.event.status] ?? 'cpub-badge-dim';
});

const typeIcon = computed(() => {
  const map: Record<string, string> = {
    'in-person': 'fa-solid fa-location-dot',
    'online': 'fa-solid fa-video',
    'hybrid': 'fa-solid fa-arrows-split-up-and-left',
  };
  return map[props.event.eventType] ?? 'fa-solid fa-calendar';
});

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
</script>

<template>
  <NuxtLink :to="`/events/${event.slug}`" class="cpub-event-card">
    <div v-if="event.coverImage" class="cpub-event-cover">
      <img :src="event.coverImage" :alt="event.title" />
    </div>
    <div class="cpub-event-body">
      <div class="cpub-event-header">
        <span class="cpub-badge" :class="statusClass">{{ event.status }}</span>
        <span v-if="event.isFeatured" class="cpub-badge cpub-badge-accent"><i class="fa-solid fa-star"></i> Featured</span>
      </div>
      <div class="cpub-event-date">
        <i class="fa-solid fa-calendar"></i>
        {{ formatDate(event.startDate) }} at {{ formatTime(event.startDate) }}
      </div>
      <h3 class="cpub-event-title">{{ event.title }}</h3>
      <p v-if="event.description" class="cpub-event-desc">{{ event.description }}</p>
      <div class="cpub-event-meta">
        <span><i :class="typeIcon"></i> {{ event.eventType }}</span>
        <span v-if="event.location"><i class="fa-solid fa-map-pin"></i> {{ event.location }}</span>
        <span><i class="fa-solid fa-users"></i> {{ event.attendeeCount }}{{ event.capacity ? ` / ${event.capacity}` : '' }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.cpub-event-card {
  display: flex;
  flex-direction: column;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  text-decoration: none;
  color: var(--text);
  transition: box-shadow 0.15s, transform 0.15s;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
.cpub-event-card:hover { box-shadow: var(--shadow-lg); transform: translate(-1px, -1px); }

.cpub-event-cover { height: 140px; overflow: hidden; }
.cpub-event-cover img { width: 100%; height: 100%; object-fit: cover; }

.cpub-event-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }

.cpub-event-header { display: flex; gap: 6px; flex-wrap: wrap; }

.cpub-event-date {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 6px;
}
.cpub-event-date i { font-size: 10px; }

.cpub-event-title { font-size: 15px; font-weight: 600; margin: 0; }

.cpub-event-desc {
  font-size: 12px;
  color: var(--text-dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-top: 4px;
}
.cpub-event-meta i { font-size: 10px; margin-right: 3px; }
</style>
