<script setup lang="ts">
import type { EventDetail } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const router = useRouter();
const { user } = useAuth();

const { data: event } = await useFetch<EventDetail>(`/api/events/${slug}`);

if (!event.value) {
  throw createError({ statusCode: 404, statusMessage: 'Event not found' });
}

const isOwner = computed(() => user.value?.id === event.value?.createdById);
const isAdmin = computed(() => user.value?.role === 'admin');
if (!isOwner.value && !isAdmin.value) {
  throw createError({ statusCode: 403, statusMessage: 'Unauthorized' });
}

useSeoMeta({ title: `Edit ${event.value.title} — Events — ${useSiteName()}` });

const saving = ref(false);
const form = reactive({
  title: event.value.title,
  description: event.value.description ?? '',
  coverImage: event.value.coverImage ?? '',
  eventType: event.value.eventType,
  status: event.value.status,
  startDate: new Date(event.value.startDate).toISOString().slice(0, 16),
  endDate: new Date(event.value.endDate).toISOString().slice(0, 16),
  timezone: event.value.timezone,
  location: event.value.location ?? '',
  locationUrl: event.value.locationUrl ?? '',
  onlineUrl: event.value.onlineUrl ?? '',
  capacity: event.value.capacity ?? undefined as number | undefined,
  isFeatured: event.value.isFeatured,
});

async function submit(): Promise<void> {
  if (!form.title || !form.startDate || !form.endDate) {
    toast.error('Title, start date, and end date are required');
    return;
  }
  if (new Date(form.startDate) >= new Date(form.endDate)) {
    toast.error('End date must be after start date');
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      title: form.title,
      status: form.status,
      eventType: form.eventType,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      timezone: form.timezone,
      isFeatured: form.isFeatured,
    };
    if (form.description) body.description = form.description;
    body.coverImage = form.coverImage || null;
    if (form.location) body.location = form.location;
    if (form.locationUrl) body.locationUrl = form.locationUrl;
    if (form.onlineUrl) body.onlineUrl = form.onlineUrl;
    if (form.capacity) body.capacity = form.capacity;

    await $fetch(`/api/events/${slug}`, { method: 'PUT', body });
    toast.success('Event updated');
    router.push(`/events/${slug}`);
  } catch {
    toast.error('Failed to update event');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="cpub-edit-event">
    <SectionHeader :title="`Edit: ${form.title}`" large />

    <form class="cpub-form" @submit.prevent="submit">
      <div class="cpub-form-field">
        <label class="cpub-form-label">Title *</label>
        <input v-model="form.title" class="cpub-form-input" required />
      </div>

      <div class="cpub-form-field">
        <label class="cpub-form-label">Description</label>
        <textarea v-model="form.description" class="cpub-form-textarea" rows="4" />
      </div>

      <ImageUpload v-model="form.coverImage" purpose="cover" label="Cover Image" hint="Recommended: 16:9 aspect ratio" />

      <div class="cpub-form-row">
        <div class="cpub-form-field">
          <label class="cpub-form-label">Type</label>
          <select v-model="form.eventType" class="cpub-form-input">
            <option value="in-person">In-Person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Status</label>
          <select v-model="form.status" class="cpub-form-input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div class="cpub-form-row">
        <div class="cpub-form-field">
          <label class="cpub-form-label">Start Date *</label>
          <input v-model="form.startDate" type="datetime-local" class="cpub-form-input" required />
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">End Date *</label>
          <input v-model="form.endDate" type="datetime-local" class="cpub-form-input" required />
        </div>
      </div>

      <div class="cpub-form-row">
        <div class="cpub-form-field">
          <label class="cpub-form-label">Capacity</label>
          <input v-model.number="form.capacity" type="number" min="1" class="cpub-form-input" placeholder="Unlimited" />
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label cpub-form-checkbox-label">
            <input type="checkbox" v-model="form.isFeatured" /> Featured Event
          </label>
        </div>
      </div>

      <div v-if="form.eventType !== 'online'" class="cpub-form-row">
        <div class="cpub-form-field">
          <label class="cpub-form-label">Location</label>
          <input v-model="form.location" class="cpub-form-input" placeholder="Venue name / address" />
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Location URL</label>
          <input v-model="form.locationUrl" type="url" class="cpub-form-input" placeholder="Map link" />
        </div>
      </div>

      <div v-if="form.eventType !== 'in-person'" class="cpub-form-field">
        <label class="cpub-form-label">Online URL</label>
        <input v-model="form.onlineUrl" type="url" class="cpub-form-input" placeholder="Meeting link" />
      </div>

      <div class="cpub-form-actions">
        <NuxtLink :to="`/events/${slug}`" class="cpub-btn cpub-btn-sm">Cancel</NuxtLink>
        <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="saving">
          <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
          Save Changes
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cpub-edit-event { max-width: 640px; margin: 0 auto; padding: 32px; }
.cpub-form { display: flex; flex-direction: column; gap: var(--space-4); margin-top: 24px; }
.cpub-form-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-form-label { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cpub-form-input { font-size: 13px; padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); outline: none; }
.cpub-form-input:focus { border-color: var(--accent); }
.cpub-form-textarea { font-size: 13px; padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); outline: none; resize: vertical; font-family: inherit; }
.cpub-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.cpub-form-checkbox-label { display: flex; align-items: center; gap: 6px; margin-top: 18px; }
.cpub-form-actions { display: flex; gap: var(--space-3); justify-content: flex-end; padding-top: var(--space-4); border-top: var(--border-width-default) solid var(--border2); }

@media (max-width: 768px) {
  .cpub-edit-event { padding: 16px; }
  .cpub-form-row { grid-template-columns: 1fr; }
}
</style>
