<script setup lang="ts">
import type { EventListItem } from '@commonpub/server';

useSeoMeta({ title: `Events — ${useSiteName()}` });

const { isAuthenticated } = useAuth();
const route = useRoute();
const router = useRouter();

const LIMIT = 12;

const activeFilter = ref<string>((route.query.filter as string) || 'upcoming');
const page = ref(Math.max(1, Number(route.query.page) || 1));
const viewMode = ref<'grid' | 'calendar'>(route.query.view === 'calendar' ? 'calendar' : 'grid');

const queryParams = computed(() => {
  // Calendar view fetches more events (no pagination, wider window)
  if (viewMode.value === 'calendar') {
    const q: Record<string, string | number> = { limit: 100 };
    if (activeFilter.value === 'mine') q.myEvents = 'true';
    return q;
  }
  const q: Record<string, string | number> = { limit: LIMIT, offset: (page.value - 1) * LIMIT };
  if (activeFilter.value === 'upcoming') q.upcoming = 'true';
  if (activeFilter.value === 'featured') q.featured = 'true';
  if (activeFilter.value === 'past') {
    q.status = 'completed';
  }
  if (activeFilter.value === 'mine') q.myEvents = 'true';
  return q;
});

const { data, refresh } = await useFetch<{ items: EventListItem[]; total: number }>('/api/events', {
  query: queryParams,
});

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / LIMIT)));

function setFilter(filter: string): void {
  activeFilter.value = filter;
  page.value = 1;
  router.replace({ query: { filter, page: undefined, view: viewMode.value !== 'grid' ? viewMode.value : undefined } });
}

function setPage(p: number): void {
  page.value = p;
  router.replace({ query: { ...route.query, page: p > 1 ? String(p) : undefined } });
}

function setView(mode: 'grid' | 'calendar'): void {
  viewMode.value = mode;
  router.replace({ query: { ...route.query, view: mode !== 'grid' ? mode : undefined } });
}
</script>

<template>
  <div class="cpub-events-page">
    <div class="cpub-events-header">
      <SectionHeader title="Events" large />
      <NuxtLink v-if="isAuthenticated" to="/events/create" class="cpub-btn-create">
        <i class="fa-solid fa-plus"></i> Create Event
      </NuxtLink>
    </div>

    <div class="cpub-events-toolbar">
      <div v-if="viewMode === 'grid'" class="cpub-events-filters" role="group" aria-label="Filter events">
        <button
          v-for="f in [
            { key: 'upcoming', label: 'Upcoming', icon: 'fa-solid fa-arrow-right', auth: false },
            { key: 'featured', label: 'Featured', icon: 'fa-solid fa-star', auth: false },
            { key: 'mine', label: 'My Events', icon: 'fa-solid fa-user', auth: true },
            { key: 'all', label: 'All', icon: 'fa-solid fa-calendar-days', auth: false },
            { key: 'past', label: 'Past', icon: 'fa-solid fa-clock-rotate-left', auth: false },
          ].filter(f => !f.auth || isAuthenticated)"
          :key="f.key"
          class="cpub-filter-btn"
          :class="{ active: activeFilter === f.key }"
          :aria-pressed="activeFilter === f.key"
          @click="setFilter(f.key)"
        >
          <i :class="f.icon"></i> {{ f.label }}
        </button>
      </div>
      <div v-else class="cpub-events-filters" />

      <div class="cpub-view-toggle" role="group" aria-label="View mode">
        <button
          class="cpub-view-btn"
          :class="{ active: viewMode === 'grid' }"
          :aria-pressed="viewMode === 'grid'"
          aria-label="Grid view"
          @click="setView('grid')"
        >
          <i class="fa-solid fa-grid-2"></i>
        </button>
        <button
          class="cpub-view-btn"
          :class="{ active: viewMode === 'calendar' }"
          :aria-pressed="viewMode === 'calendar'"
          aria-label="Calendar view"
          @click="setView('calendar')"
        >
          <i class="fa-solid fa-calendar"></i>
        </button>
      </div>
    </div>

    <template v-if="viewMode === 'calendar'">
      <EventCalendar :events="data?.items ?? []" />
    </template>
    <template v-else>
      <div v-if="data?.items?.length" class="cpub-events-grid">
        <EventCard v-for="event in data.items" :key="event.id" :event="event" />
      </div>
      <div v-else class="cpub-empty-state">
        <div class="cpub-empty-state-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <p class="cpub-empty-state-title">No events found</p>
        <p class="cpub-empty-state-desc">
          {{ activeFilter === 'upcoming' ? 'No upcoming events scheduled.' : activeFilter === 'past' ? 'No past events.' : activeFilter === 'mine' ? "You haven't created or registered for any events yet." : 'Check back soon for events.' }}
        </p>
      </div>

      <nav v-if="totalPages > 1" class="cpub-events-pagination" aria-label="Events pagination">
        <button class="cpub-page-btn" :disabled="page <= 1" aria-label="Previous page" @click="setPage(page - 1)">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="cpub-page-info">{{ page }} / {{ totalPages }}</span>
        <button class="cpub-page-btn" :disabled="page >= totalPages" aria-label="Next page" @click="setPage(page + 1)">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.cpub-events-page { max-width: 960px; margin: 0 auto; padding: 32px; }
.cpub-events-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cpub-btn-create {
  font-size: 12px; padding: 6px 14px; background: var(--accent); color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--border); text-decoration: none;
  display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);
  transition: all 0.15s;
}
.cpub-btn-create:hover { box-shadow: var(--shadow-md); transform: translate(-1px, -1px); }

.cpub-events-toolbar {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px;
}
.cpub-events-filters {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.cpub-filter-btn {
  font-family: var(--font-mono); font-size: 11px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.04em;
  padding: 5px 12px; border: var(--border-width-default) solid var(--border2);
  background: var(--surface); color: var(--text-dim); cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
  transition: all 0.15s;
}
.cpub-filter-btn:hover { border-color: var(--border); color: var(--text); }
.cpub-filter-btn.active {
  background: var(--accent); color: var(--color-text-inverse);
  border-color: var(--border); box-shadow: var(--shadow-sm);
}
.cpub-filter-btn i { font-size: 10px; }

.cpub-view-toggle { display: flex; gap: 2px; flex-shrink: 0; }
.cpub-view-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border: var(--border-width-default) solid var(--border2); background: var(--surface);
  color: var(--text-faint); cursor: pointer; font-size: 12px; transition: all 0.15s;
}
.cpub-view-btn:hover { border-color: var(--border); color: var(--text); }
.cpub-view-btn.active { background: var(--accent); color: var(--color-text-inverse); border-color: var(--border); }

.cpub-events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

.cpub-events-pagination {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-top: 24px; padding-top: 20px; border-top: var(--border-width-default) solid var(--border2);
}
.cpub-page-btn {
  padding: 6px 10px; border: var(--border-width-default) solid var(--border);
  background: var(--surface); color: var(--text); cursor: pointer;
  font-size: 12px; transition: all 0.15s;
}
.cpub-page-btn:hover:not(:disabled) { box-shadow: var(--shadow-sm); }
.cpub-page-btn:disabled { opacity: 0.3; cursor: default; }
.cpub-page-info {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);
  letter-spacing: 0.04em;
}

@media (max-width: 768px) {
  .cpub-events-page { padding: 16px; }
  .cpub-events-grid { grid-template-columns: 1fr; }
}
</style>
