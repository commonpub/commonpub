<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { show: toast } = useToast();
const saving = ref(false);

const prefs = ref({
  emailLikes: true,
  emailComments: true,
  emailFollows: true,
  emailMentions: true,
  emailDigest: false,
});

// Load current preferences from profile
const { data: profile } = await useFetch('/api/profile');
if (profile.value?.notificationPrefs) {
  const saved = profile.value.notificationPrefs as Record<string, boolean>;
  for (const key of Object.keys(prefs.value)) {
    if (key in saved) {
      (prefs.value as Record<string, boolean>)[key] = saved[key];
    }
  }
}

const labels: Record<string, string> = {
  emailLikes: 'Email when someone likes your content',
  emailComments: 'Email when someone comments on your content',
  emailFollows: 'Email when someone follows you',
  emailMentions: 'Email when someone mentions you',
  emailDigest: 'Weekly digest email',
};

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: { notificationPrefs: prefs.value },
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

    <div v-for="(val, key) in prefs" :key="key" style="margin-bottom: 12px">
      <label class="cpub-checkbox">
        <input type="checkbox" v-model="prefs[key as keyof typeof prefs]" />
        {{ labels[key] || key }}
      </label>
    </div>

    <button class="cpub-btn cpub-btn-primary cpub-btn-sm" style="margin-top: 16px" :disabled="saving" @click="handleSave">
      {{ saving ? 'Saving...' : 'Save Preferences' }}
    </button>
  </div>
</template>
