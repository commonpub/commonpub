<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();

import type { Serialized, HubDetail } from '@commonpub/server';

const { data: hub } = useLazyFetch<Serialized<HubDetail>>(() => `/api/hubs/${slug.value}`);

useSeoMeta({
  title: () => `Settings — ${hub.value?.name ?? 'Hub'} — CommonPub`,
});

const form = reactive({
  name: hub.value?.name ?? '',
  description: hub.value?.description ?? '',
  rules: (hub.value?.rules ?? []).join('\n'),
  joinPolicy: hub.value?.joinPolicy ?? 'open',
  privacy: hub.value?.privacy ?? 'public',
  website: hub.value?.website ?? '',
});

const saving = ref(false);
const { extract: extractError } = useApiError();

async function handleSave(): Promise<void> {
  saving.value = true;

  try {
    await $fetch(`/api/hubs/${slug.value}`, {
      method: 'PUT',
      body: {
        name: form.name,
        description: form.description || null,
        rules: form.rules.split('\n').map((r) => r.trim()).filter(Boolean),
        joinPolicy: form.joinPolicy,
        privacy: form.privacy,
        website: form.website || null,
      },
    });
    toast.success('Hub settings saved');
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="hub" class="cpub-hub-settings">
    <div class="cpub-settings-header">
      <NuxtLink :to="`/hubs/${slug}`" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> Back to hub
      </NuxtLink>
      <h1 class="cpub-settings-title">Hub Settings</h1>
      <p class="cpub-settings-subtitle">Manage {{ hub.name }}</p>
    </div>

    <form class="cpub-settings-form" @submit.prevent="handleSave">
      <div class="cpub-field">
        <label for="hub-name" class="cpub-field-label">Name</label>
        <input
          id="hub-name"
          v-model="form.name"
          type="text"
          class="cpub-field-input"
          required
          placeholder="Hub name"
        />
      </div>

      <div class="cpub-field">
        <label for="hub-desc" class="cpub-field-label">Description</label>
        <textarea
          id="hub-desc"
          v-model="form.description"
          class="cpub-field-input cpub-field-textarea"
          rows="3"
          placeholder="What is this hub about?"
        />
      </div>

      <div class="cpub-field">
        <label for="hub-website" class="cpub-field-label">Website</label>
        <input
          id="hub-website"
          v-model="form.website"
          type="url"
          class="cpub-field-input"
          placeholder="https://example.com"
        />
      </div>

      <div class="cpub-field">
        <label for="hub-rules" class="cpub-field-label">Rules (one per line)</label>
        <textarea
          id="hub-rules"
          v-model="form.rules"
          class="cpub-field-input cpub-field-textarea"
          rows="4"
          placeholder="Be respectful&#10;Stay on topic&#10;No spam"
        />
      </div>

      <div class="cpub-field-row">
        <div class="cpub-field">
          <label for="hub-join" class="cpub-field-label">Join Policy</label>
          <select id="hub-join" v-model="form.joinPolicy" class="cpub-field-input">
            <option value="open">Open — anyone can join</option>
            <option value="approval">Approval — requests must be approved</option>
            <option value="invite">Invite Only</option>
          </select>
        </div>

        <div class="cpub-field">
          <label for="hub-privacy" class="cpub-field-label">Privacy</label>
          <select id="hub-privacy" v-model="form.privacy" class="cpub-field-input">
            <option value="public">Public — visible to everyone</option>
            <option value="private">Private — members only</option>
          </select>
        </div>
      </div>

      <div class="cpub-form-actions">
        <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !form.name">
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <NuxtLink :to="`/hubs/${slug}`" class="cpub-btn">Cancel</NuxtLink>
      </div>
    </form>
  </div>

  <div v-else class="cpub-empty-state" style="padding: 64px 24px">
    <p class="cpub-empty-state-title">Hub not found</p>
  </div>
</template>

<style scoped>
.cpub-hub-settings {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px;
}

.cpub-settings-header {
  margin-bottom: 32px;
}

/* cpub-back-link → global components.css */

.cpub-settings-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.cpub-settings-subtitle {
  font-size: 13px;
  color: var(--text-dim);
}

.cpub-settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cpub-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-field-label {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.cpub-field-input {
  padding: 8px 12px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}

.cpub-field-input:focus {
  border-color: var(--accent);
}

.cpub-field-input::placeholder {
  color: var(--text-faint);
}

.cpub-field-textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

.cpub-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cpub-form-actions {
  display: flex;
  gap: 10px;
  padding-top: 8px;
}

select.cpub-field-input { cursor: pointer; }

@media (max-width: 640px) {
  .cpub-hub-settings { padding: 16px; }
  .cpub-field-row { grid-template-columns: 1fr; }
}
</style>
