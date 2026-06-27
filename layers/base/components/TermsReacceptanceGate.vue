<script setup lang="ts">
// Terms re-acceptance interstitial (GDPR Phase 2). When the `requireTermsAcceptance`
// feature is on and the logged-in user's accepted terms version is behind the
// instance `termsVersion`, this blocking modal asks them to re-accept before
// continuing. The server owns the decision (GET /api/consent/status); this just
// renders it. Inert for logged-out users and when the feature is off.
const { user } = useAuth();
const router = useRouter();
const show = ref(false);
const accepting = ref(false);

// Don't cover the legal pages themselves — the user must be able to READ the
// Terms/Privacy/Cookies before accepting (the gate's links open them, now that
// the gate is mounted globally via a plugin it would otherwise block them).
const LEGAL_PREFIXES = ['/terms', '/privacy', '/cookies'];
const onLegalPage = computed(() => {
  const p = router.currentRoute.value.path;
  return LEGAL_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
});
const visible = computed(() => show.value && !onLegalPage.value);

// Untyped view of $fetch for these two known endpoints. When this component is
// imported into the terms-gate.client.ts plugin (a .ts file), Nuxt's typed-route
// inference trips TS2589 ("excessively deep") on the generic $fetch form.
const apiFetch = $fetch as unknown as (url: string, opts?: Record<string, unknown>) => Promise<unknown>;

async function check(): Promise<void> {
  if (typeof window === 'undefined' || !user.value) { show.value = false; return; }
  try {
    const r = (await apiFetch('/api/consent/status')) as { termsReacceptanceRequired: boolean };
    show.value = r.termsReacceptanceRequired;
  } catch {
    show.value = false;
  }
}

async function accept(): Promise<void> {
  accepting.value = true;
  try {
    await apiFetch('/api/consent', { method: 'POST', body: { kind: 'terms' } });
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
  <div v-if="visible" class="cpub-trg" role="dialog" aria-modal="true" aria-labelledby="cpub-trg-title">
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
