<script setup lang="ts">
// Terms re-acceptance interstitial (GDPR Phase 2). When the `requireTermsAcceptance`
// feature is on and the logged-in user's accepted terms version is behind the
// instance `termsVersion`, this blocking modal asks them to re-accept before
// continuing. The server owns the decision (GET /api/consent/status); this just
// renders it. Inert for logged-out users and when the feature is off.
const { user } = useAuth();
const show = ref(false);
const accepting = ref(false);

async function check(): Promise<void> {
  if (typeof window === 'undefined' || !user.value) { show.value = false; return; }
  try {
    const r = await $fetch<{ termsReacceptanceRequired: boolean }>('/api/consent/status');
    show.value = r.termsReacceptanceRequired;
  } catch {
    show.value = false;
  }
}

async function accept(): Promise<void> {
  accepting.value = true;
  try {
    await $fetch('/api/consent', { method: 'POST', body: { kind: 'terms' } });
    show.value = false;
  } catch {
    // leave the gate up; the user can retry
  } finally {
    accepting.value = false;
  }
}

watch(user, check, { immediate: true });
</script>

<template>
  <div v-if="show" class="cpub-trg" role="dialog" aria-modal="true" aria-labelledby="cpub-trg-title">
    <div class="cpub-trg-card">
      <h2 id="cpub-trg-title" class="cpub-trg-title">Our terms have been updated</h2>
      <p class="cpub-trg-body">Please review and accept the updated Terms of Service and Code of Conduct to continue using your account.</p>
      <p class="cpub-trg-links">
        <NuxtLink to="/terms" target="_blank" rel="noopener">Terms of Service and Code of Conduct</NuxtLink>
        <span aria-hidden="true"> · </span>
        <NuxtLink to="/privacy" target="_blank" rel="noopener">Privacy Policy</NuxtLink>
      </p>
      <button type="button" class="cpub-btn" :disabled="accepting" @click="accept">
        {{ accepting ? 'Saving...' : 'I accept' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-trg {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.cpub-trg-card {
  max-width: 460px;
  width: 100%;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cpub-trg-title { font-size: 18px; font-weight: 700; margin: 0; }
.cpub-trg-body { font-size: 14px; color: var(--text-dim); line-height: 1.7; margin: 0; }
.cpub-trg-links { font-size: 13px; margin: 0; }
.cpub-trg-links a { color: var(--accent); text-decoration: none; }
.cpub-trg-links a:hover { text-decoration: underline; }
</style>
