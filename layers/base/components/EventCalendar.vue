<script setup lang="ts">
import type { EventListItem } from '@commonpub/server';

const props = defineProps<{
  events: EventListItem[];
}>();

const today = new Date();
const currentMonth = ref(today.getMonth());
const currentYear = ref(today.getFullYear());

const monthName = computed(() =>
  new Date(currentYear.value, currentMonth.value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface CalendarDay {
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: EventListItem[];
  key: string;
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build event lookup: dateString → events[]
  const eventMap = new Map<string, EventListItem[]>();
  for (const ev of props.events) {
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    // Mark each day the event spans
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    let safetyCount = 0;
    while (d <= endDay && safetyCount++ < 366) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = eventMap.get(key) ?? [];
      list.push(ev);
      eventMap.set(key, list);
      d.setDate(d.getDate() + 1);
    }
  }

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = daysInPrevMonth - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    const key = `${y}-${m}-${date}`;
    days.push({ date, isCurrentMonth: false, isToday: false, events: eventMap.get(key) ?? [], key: `p-${date}` });
  }

  // Current month
  for (let date = 1; date <= daysInMonth; date++) {
    const isToday = date === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const key = `${year}-${month}-${date}`;
    days.push({ date, isCurrentMonth: true, isToday, events: eventMap.get(key) ?? [], key: `c-${date}` });
  }

  // Next month padding (fill to complete 6 rows)
  const remaining = 42 - days.length;
  for (let date = 1; date <= remaining; date++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    const key = `${y}-${m}-${date}`;
    days.push({ date, isCurrentMonth: false, isToday: false, events: eventMap.get(key) ?? [], key: `n-${date}` });
  }

  return days;
});

function prevMonth(): void {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth(): void {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

function goToday(): void {
  currentMonth.value = today.getMonth();
  currentYear.value = today.getFullYear();
}

const typeIcon: Record<string, string> = {
  'in-person': 'fa-solid fa-location-dot',
  'online': 'fa-solid fa-video',
  'hybrid': 'fa-solid fa-arrows-split-up-and-left',
};
</script>

<template>
  <div class="cpub-calendar">
    <div class="cpub-cal-header">
      <button class="cpub-cal-nav" aria-label="Previous month" @click="prevMonth">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <button class="cpub-cal-title" @click="goToday">{{ monthName }}</button>
      <button class="cpub-cal-nav" aria-label="Next month" @click="nextMonth">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div class="cpub-cal-weekdays">
      <div v-for="day in WEEKDAYS" :key="day" class="cpub-cal-weekday">{{ day }}</div>
    </div>

    <div class="cpub-cal-grid">
      <div
        v-for="day in calendarDays"
        :key="day.key"
        class="cpub-cal-day"
        :class="{
          'cpub-cal-other': !day.isCurrentMonth,
          'cpub-cal-today': day.isToday,
          'cpub-cal-has-events': day.events.length > 0,
        }"
      >
        <span class="cpub-cal-date">{{ day.date }}</span>
        <div v-if="day.events.length > 0" class="cpub-cal-events">
          <NuxtLink
            v-for="ev in day.events.slice(0, 2)"
            :key="ev.id"
            :to="`/events/${ev.slug}`"
            class="cpub-cal-event"
            :title="ev.title"
          >
            <i :class="typeIcon[ev.eventType] ?? 'fa-solid fa-calendar'" class="cpub-cal-event-icon"></i>
            <span class="cpub-cal-event-title">{{ ev.title }}</span>
          </NuxtLink>
          <span v-if="day.events.length > 2" class="cpub-cal-more">
            +{{ day.events.length - 2 }} more
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-calendar {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.cpub-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-cal-nav {
  background: none;
  border: var(--border-width-default) solid var(--border2);
  color: var(--text-dim);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.cpub-cal-nav:hover { border-color: var(--border); color: var(--text); }

.cpub-cal-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
}
.cpub-cal-title:hover { color: var(--accent); }

.cpub-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-cal-weekday {
  padding: 6px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.cpub-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.cpub-cal-day {
  min-height: 80px;
  padding: 4px 6px;
  border-right: var(--border-width-default) solid var(--border2);
  border-bottom: var(--border-width-default) solid var(--border2);
  position: relative;
}
.cpub-cal-day:nth-child(7n) { border-right: none; }

.cpub-cal-other { background: var(--surface2); }
.cpub-cal-other .cpub-cal-date { color: var(--text-faint); }

.cpub-cal-today { background: var(--accent-bg); }
.cpub-cal-today .cpub-cal-date {
  color: var(--accent);
  font-weight: 700;
}

.cpub-cal-date {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
  display: block;
  margin-bottom: 2px;
}

.cpub-cal-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cpub-cal-event {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 4px;
  background: var(--accent-bg);
  border-left: 2px solid var(--accent);
  text-decoration: none;
  overflow: hidden;
  transition: background 0.12s;
}
.cpub-cal-event:hover { background: var(--surface3); }

.cpub-cal-event-icon {
  font-size: 8px;
  color: var(--accent);
  flex-shrink: 0;
}

.cpub-cal-event-title {
  font-size: 10px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.cpub-cal-more {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  padding-left: 4px;
}

@media (max-width: 768px) {
  .cpub-cal-day { min-height: 50px; padding: 2px 3px; }
  .cpub-cal-event-title { display: none; }
  .cpub-cal-event { padding: 2px; justify-content: center; border-left: none; }
  .cpub-cal-event-icon { font-size: 10px; }
  .cpub-cal-more { display: none; }
}
</style>
