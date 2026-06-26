<script setup lang="ts">
// Public email unsubscribe page (email Phase 1b). Reads the HMAC token from the
// query and lets the recipient unsubscribe from digests or from all email. The
// token is the authorization, so this works logged out.
const route = useRoute();
const token = computed(() => (route.query.token as string) || '');

useSeoMeta({ title: `Email preferences, ${useSiteName()}` });

const state = ref<'choose' | 'done' | 'error'>(token.value ? 'choose' : 'error');
const busy = ref(false);
const doneScope = ref<'digest' | 'all'>('all');

async function unsubscribe(scope: 'digest' | 'all'): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    await $fetch('/api/unsubscribe', { method: 'POST', body: { token: token.value, scope } });
    doneScope.value = scope;
    state.value = 'done';
  } catch {
    state.value = 'error';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="cpub-unsub">
    <h1 class="cpub-unsub-title">Email preferences</h1>

    <div v-if="state === 'error'" class="cpub-unsub-card">
      <p>This unsubscribe link is invalid or has expired. You can manage email preferences from your account settings.</p>
      <NuxtLink to="/settings/notifications" class="cpub-btn">Go to settings</NuxtLink>
    </div>

    <div v-else-if="state === 'done'" class="cpub-unsub-card">
      <p v-if="doneScope === 'all'">You have been unsubscribed from all emails. You can turn them back on anytime in your settings.</p>
      <p v-else>You have been unsubscribed from digest emails. You can change this anytime in your settings.</p>
      <NuxtLink to="/settings/notifications" class="cpub-btn">Notification settings</NuxtLink>
    </div>

    <div v-else class="cpub-unsub-card">
      <p>Choose what to unsubscribe from. You can re-enable email anytime in your settings.</p>
      <div class="cpub-unsub-actions">
        <button type="button" class="cpub-btn" :disabled="busy" @click="unsubscribe('digest')">
          Unsubscribe from digest emails
        </button>
        <button type="button" class="cpub-btn cpub-btn-danger" :disabled="busy" @click="unsubscribe('all')">
          Unsubscribe from all emails
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-unsub { max-width: 560px; margin: 0 auto; padding: 48px 24px; }
.cpub-unsub-title { font-size: 20px; font-weight: 700; margin: 0 0 20px; }
.cpub-unsub-card {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cpub-unsub-card p { margin: 0; color: var(--text-dim); font-size: 14px; line-height: 1.7; }
.cpub-unsub-actions { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.cpub-btn-danger { color: var(--red-text); border-color: var(--red); background: var(--red-bg); }
</style>
