<script setup lang="ts">
import type { EventDetail, AttendeeItem, AttendeeStatus } from '@commonpub/server';

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { isAuthenticated, user } = useAuth();

const { data: event, refresh } = await useFetch<EventDetail>(`/api/events/${slug}`);
const { data: attendees } = await useFetch<{ items: AttendeeItem[]; total: number }>(`/api/events/${slug}/attendees`);

useSeoMeta({ title: event.value ? `${event.value.title} — Events — ${useSiteName()}` : `Event — ${useSiteName()}` });

const rsvpLoading = ref(false);

const myRsvpStatus = computed((): AttendeeStatus | null => {
  if (!isAuthenticated.value || !attendees.value) return null;
  const found = attendees.value.items.find(a => a.userId === user.value?.id);
  return found?.status ?? null;
});

const isOwner = computed(() => user.value?.id === event.value?.createdById);
const isAdmin = computed(() => user.value?.role === 'admin');
const canEdit = computed(() => isOwner.value || isAdmin.value);
const spotsLeft = computed(() => {
  if (!event.value?.capacity) return null;
  return Math.max(0, event.value.capacity - event.value.attendeeCount);
});

async function rsvp(): Promise<void> {
  rsvpLoading.value = true;
  try {
    await $fetch(`/api/events/${slug}/rsvp`, { method: 'POST' });
    toast.success('RSVP confirmed');
    await refresh();
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? 'RSVP failed';
    toast.error(msg);
  } finally {
    rsvpLoading.value = false;
  }
}

async function cancelRsvp(): Promise<void> {
  rsvpLoading.value = true;
  try {
    await $fetch(`/api/events/${slug}/rsvp`, { method: 'DELETE' });
    toast.success('RSVP cancelled');
    await refresh();
  } catch {
    toast.error('Failed to cancel RSVP');
  } finally {
    rsvpLoading.value = false;
  }
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

const typeIcon = computed(() => {
  const map: Record<string, string> = {
    'in-person': 'fa-solid fa-location-dot',
    'online': 'fa-solid fa-video',
    'hybrid': 'fa-solid fa-arrows-split-up-and-left',
  };
  return map[event.value?.eventType ?? ''] ?? 'fa-solid fa-calendar';
});
</script>

<template>
  <div v-if="event" class="cpub-event-detail">
    <div v-if="event.coverImage" class="cpub-event-hero">
      <img :src="event.coverImage" :alt="event.title" />
    </div>

    <div class="cpub-event-content">
      <div class="cpub-event-main">
        <div class="cpub-event-badges">
          <span class="cpub-badge" :class="{
            'cpub-badge-green': event.status === 'active',
            'cpub-badge-accent': event.status === 'published',
            'cpub-badge-dim': event.status === 'completed',
            'cpub-badge-red': event.status === 'cancelled',
            'cpub-badge-yellow': event.status === 'draft',
          }">{{ event.status }}</span>
          <span v-if="event.isFeatured" class="cpub-badge cpub-badge-accent"><i class="fa-solid fa-star"></i> Featured</span>
          <span class="cpub-badge"><i :class="typeIcon"></i> {{ event.eventType }}</span>
        </div>

        <h1 class="cpub-event-title">{{ event.title }}</h1>

        <div class="cpub-event-info-grid">
          <div class="cpub-event-info-item">
            <i class="fa-solid fa-calendar"></i>
            <div>
              <div>{{ formatDate(event.startDate) }}</div>
              <div class="cpub-event-info-sub">{{ formatTime(event.startDate) }} — {{ formatTime(event.endDate) }}</div>
            </div>
          </div>
          <div v-if="event.location" class="cpub-event-info-item">
            <i class="fa-solid fa-map-pin"></i>
            <div>
              <div>{{ event.location }}</div>
              <a v-if="event.locationUrl" :href="event.locationUrl" target="_blank" rel="noopener" class="cpub-event-info-sub">View map <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px;"></i></a>
            </div>
          </div>
          <div v-if="event.onlineUrl" class="cpub-event-info-item">
            <i class="fa-solid fa-video"></i>
            <div>
              <a :href="event.onlineUrl" target="_blank" rel="noopener">Join online <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px;"></i></a>
            </div>
          </div>
        </div>

        <div v-if="event.description" class="cpub-event-description">
          {{ event.description }}
        </div>

        <div class="cpub-event-organizer">
          <span class="cpub-event-organizer-label">Organized by</span>
          <NuxtLink :to="`/u/${event.createdByUsername}`" class="cpub-event-organizer-link">
            <span class="cpub-event-avatar">
              <img v-if="event.createdByAvatar" :src="event.createdByAvatar" :alt="event.createdByName" />
              <span v-else>{{ event.createdByName.charAt(0) }}</span>
            </span>
            {{ event.createdByName }}
          </NuxtLink>
        </div>
      </div>

      <aside class="cpub-event-sidebar">
        <div class="cpub-event-rsvp-card">
          <div class="cpub-event-rsvp-count">
            <span class="cpub-event-rsvp-num">{{ event.attendeeCount }}</span>
            <span class="cpub-event-rsvp-label">{{ event.attendeeCount === 1 ? 'attendee' : 'attendees' }}</span>
          </div>
          <div v-if="spotsLeft !== null" class="cpub-event-rsvp-spots">
            {{ spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event is full' }}
          </div>

          <template v-if="isAuthenticated && event.status !== 'completed' && event.status !== 'cancelled' && event.status !== 'draft'">
            <button
              v-if="!myRsvpStatus"
              class="cpub-btn cpub-btn-primary cpub-btn-block"
              :disabled="rsvpLoading || (spotsLeft !== null && spotsLeft <= 0)"
              @click="rsvp"
            >
              <i :class="rsvpLoading ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
              {{ spotsLeft !== null && spotsLeft <= 0 ? 'Join Waitlist' : 'RSVP' }}
            </button>
            <div v-else class="cpub-event-rsvp-status">
              <span class="cpub-badge cpub-badge-green" v-if="myRsvpStatus === 'registered'">Registered</span>
              <span class="cpub-badge cpub-badge-yellow" v-else-if="myRsvpStatus === 'waitlisted'">Waitlisted</span>
              <button class="cpub-btn cpub-btn-sm cpub-btn-block" :disabled="rsvpLoading" @click="cancelRsvp">
                Cancel RSVP
              </button>
            </div>
          </template>

          <NuxtLink v-if="canEdit" :to="`/events/${event.slug}/edit`" class="cpub-btn cpub-btn-sm cpub-btn-block" style="margin-top: 8px; text-align: center;">
            <i class="fa-solid fa-pencil"></i> Edit Event
          </NuxtLink>
        </div>

        <div v-if="attendees?.items?.length" class="cpub-event-attendees-preview">
          <h3 class="cpub-event-sidebar-title">Attendees</h3>
          <div class="cpub-event-attendees-list">
            <NuxtLink
              v-for="att in attendees.items.slice(0, 8)"
              :key="att.id"
              :to="`/u/${att.userUsername}`"
              class="cpub-event-attendee"
              :title="att.userName"
            >
              <span class="cpub-event-avatar cpub-event-avatar-sm">
                <img v-if="att.userAvatar" :src="att.userAvatar" :alt="att.userName" />
                <span v-else>{{ att.userName.charAt(0) }}</span>
              </span>
            </NuxtLink>
            <span v-if="attendees.total > 8" class="cpub-event-attendee-more">+{{ attendees.total - 8 }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cpub-event-detail { max-width: 960px; margin: 0 auto; padding: 32px; }
.cpub-event-hero { height: 240px; overflow: hidden; border: var(--border-width-default) solid var(--border); margin-bottom: 24px; }
.cpub-event-hero img { width: 100%; height: 100%; object-fit: cover; }

.cpub-event-content { display: grid; grid-template-columns: 1fr 280px; gap: 32px; }
.cpub-event-main { min-width: 0; }

.cpub-event-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.cpub-event-title { font-size: 24px; font-weight: 700; margin: 0 0 20px; }

.cpub-event-info-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.cpub-event-info-item { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; }
.cpub-event-info-item > i { width: 16px; text-align: center; margin-top: 3px; color: var(--accent); }
.cpub-event-info-sub { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.cpub-event-info-sub a { color: var(--accent); text-decoration: none; }

.cpub-event-description { font-size: 14px; line-height: 1.7; color: var(--text-dim); white-space: pre-wrap; margin-bottom: 24px; }

.cpub-event-organizer { padding-top: 16px; border-top: var(--border-width-default) solid var(--border2); }
.cpub-event-organizer-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); display: block; margin-bottom: 8px; }
.cpub-event-organizer-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); font-size: 13px; font-weight: 600; }

.cpub-event-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--surface2); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; overflow: hidden; flex-shrink: 0; }
.cpub-event-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cpub-event-avatar-sm { width: 24px; height: 24px; font-size: 9px; }

.cpub-event-sidebar { display: flex; flex-direction: column; gap: 16px; }
.cpub-event-rsvp-card { padding: 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 12px; }
.cpub-event-rsvp-count { display: flex; align-items: baseline; gap: 6px; }
.cpub-event-rsvp-num { font-size: 24px; font-weight: 700; font-family: var(--font-mono); }
.cpub-event-rsvp-label { font-size: 12px; color: var(--text-dim); }
.cpub-event-rsvp-spots { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-event-rsvp-status { display: flex; flex-direction: column; gap: 8px; }
.cpub-btn-block { width: 100%; justify-content: center; }

.cpub-event-attendees-preview { padding: 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); }
.cpub-event-sidebar-title { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); margin: 0 0 12px; }
.cpub-event-attendees-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.cpub-event-attendee { text-decoration: none; }
.cpub-event-attendee-more { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: 4px; }

@media (max-width: 768px) {
  .cpub-event-detail { padding: 16px; }
  .cpub-event-content { grid-template-columns: 1fr; gap: 20px; }
  .cpub-event-hero { height: 180px; }
  .cpub-event-title { font-size: 20px; }
}
</style>
