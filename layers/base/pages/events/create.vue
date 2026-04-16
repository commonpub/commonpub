<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Create Event — ${useSiteName()}` });

const toast = useToast();
const router = useRouter();
const saving = ref(false);

const form = reactive({
  title: '',
  description: '',
  eventType: 'in-person' as 'in-person' | 'online' | 'hybrid',
  startDate: '',
  endDate: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  location: '',
  locationUrl: '',
  onlineUrl: '',
  capacity: undefined as number | undefined,
});

async function submit(): Promise<void> {
  if (!form.title || !form.startDate || !form.endDate) {
    toast.error('Title, start date, and end date are required');
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      title: form.title,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      eventType: form.eventType,
      timezone: form.timezone,
    };
    if (form.description) body.description = form.description;
    if (form.location) body.location = form.location;
    if (form.locationUrl) body.locationUrl = form.locationUrl;
    if (form.onlineUrl) body.onlineUrl = form.onlineUrl;
    if (form.capacity) body.capacity = form.capacity;

    const result = await $fetch<{ slug: string }>('/api/events', {
      method: 'POST',
      body,
    });
    toast.success('Event created');
    router.push(`/events/${result.slug}`);
  } catch {
    toast.error('Failed to create event');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="cpub-create-event">
    <SectionHeader title="Create Event" large />

    <form class="cpub-form" @submit.prevent="submit">
      <div class="cpub-form-field">
        <label class="cpub-form-label">Title *</label>
        <input v-model="form.title" class="cpub-form-input" placeholder="Event title" required />
      </div>

      <div class="cpub-form-field">
        <label class="cpub-form-label">Description</label>
        <textarea v-model="form.description" class="cpub-form-textarea" rows="4" placeholder="Describe the event..." />
      </div>

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
          <label class="cpub-form-label">Capacity</label>
          <input v-model.number="form.capacity" type="number" min="1" class="cpub-form-input" placeholder="Unlimited" />
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
        <NuxtLink to="/events" class="cpub-btn cpub-btn-sm">Cancel</NuxtLink>
        <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="saving">
          <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
          Create Event
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cpub-create-event { max-width: 640px; margin: 0 auto; padding: 32px; }
.cpub-form { display: flex; flex-direction: column; gap: var(--space-4); margin-top: 24px; }
.cpub-form-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-form-label { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cpub-form-input { font-size: 13px; padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); outline: none; }
.cpub-form-input:focus { border-color: var(--accent); }
.cpub-form-textarea { font-size: 13px; padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); outline: none; resize: vertical; font-family: inherit; }
.cpub-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.cpub-form-actions { display: flex; gap: var(--space-3); justify-content: flex-end; padding-top: var(--space-4); border-top: var(--border-width-default) solid var(--border2); }

@media (max-width: 768px) {
  .cpub-create-event { padding: 16px; }
  .cpub-form-row { grid-template-columns: 1fr; }
}
</style>
