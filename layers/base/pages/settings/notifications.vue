<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { show: toast } = useToast();
const saving = ref(false);

const likes = ref(true);
const comments = ref(true);
const follows = ref(true);
const mentions = ref(true);
const digest = ref<'none' | 'daily' | 'weekly'>('none');

// Load current preferences from profile
import type { Serialized, UserProfile } from '@commonpub/server';

const { data: profile, pending } = await useFetch<Serialized<UserProfile> & { emailNotifications?: { digest?: string; likes?: boolean; comments?: boolean; follows?: boolean; mentions?: boolean } }>('/api/profile');
if (profile.value?.emailNotifications) {
  const saved = profile.value.emailNotifications;
  if (saved.likes !== undefined) likes.value = saved.likes;
  if (saved.comments !== undefined) comments.value = saved.comments;
  if (saved.follows !== undefined) follows.value = saved.follows;
  if (saved.mentions !== undefined) mentions.value = saved.mentions;
  if (saved.digest) digest.value = saved.digest as 'none' | 'daily' | 'weekly';
}

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: {
        emailNotifications: {
          likes: likes.value,
          comments: comments.value,
          follows: follows.value,
          mentions: mentions.value,
          digest: digest.value,
        },
      },
    });
    toast('Preferences saved', 'success');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save preferences';
    toast(msg, 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Notification Preferences</h2>

    <div v-if="pending" style="padding: 32px; text-align: center; color: var(--text-faint);">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Loading preferences...
    </div>

    <template v-else>
    <div class="cpub-prefs-section">
      <h3 class="cpub-section-subtitle">Email Notifications</h3>
      <div class="cpub-pref-row">
        <label class="cpub-checkbox"><input type="checkbox" v-model="likes" /> Email when someone likes your content</label>
      </div>
      <div class="cpub-pref-row">
        <label class="cpub-checkbox"><input type="checkbox" v-model="comments" /> Email when someone comments on your content</label>
      </div>
      <div class="cpub-pref-row">
        <label class="cpub-checkbox"><input type="checkbox" v-model="follows" /> Email when someone follows you</label>
      </div>
      <div class="cpub-pref-row">
        <label class="cpub-checkbox"><input type="checkbox" v-model="mentions" /> Email when someone mentions you</label>
      </div>
    </div>

    <div class="cpub-prefs-section">
      <h3 class="cpub-section-subtitle">Digest</h3>
      <div class="cpub-pref-row">
        <label for="digest-select">Summary email frequency</label>
        <select id="digest-select" v-model="digest" class="cpub-input" style="max-width: 200px;">
          <option value="none">None</option>
          <option value="daily">Daily (8am UTC)</option>
          <option value="weekly">Weekly (Monday 8am UTC)</option>
        </select>
      </div>
    </div>

    <button class="cpub-btn cpub-btn-primary cpub-btn-sm" style="margin-top: 16px" :disabled="saving" @click="handleSave">
      {{ saving ? 'Saving...' : 'Save Preferences' }}
    </button>
    </template>
  </div>
</template>

<style scoped>
.cpub-prefs-section { margin-bottom: 24px; }
.cpub-section-subtitle { font-size: 13px; font-weight: 700; margin-bottom: 12px; color: var(--text); }
.cpub-pref-row { margin-bottom: 10px; }
</style>
