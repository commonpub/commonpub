<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'auth',
});

useHead({ title: 'Authorize Application' });

const route = useRoute();

const clientId = computed(() => route.query.client_id as string ?? '');
const redirectUri = computed(() => route.query.redirect_uri as string ?? '');
const responseType = computed(() => route.query.response_type as string ?? '');
const scope = computed(() => route.query.scope as string ?? '');
const state = computed(() => route.query.state as string ?? '');

const loading = ref(false);
const error = ref<string | null>(null);

async function approve() {
  loading.value = true;
  error.value = null;
  try {
    const result = await $fetch<{ redirectUrl: string }>('/api/auth/oauth2/authorize', {
      method: 'POST',
      body: {
        clientId: clientId.value,
        redirectUri: redirectUri.value,
        responseType: responseType.value,
        scope: scope.value,
        state: state.value,
      },
    });
    // Redirect back to the requesting instance with the auth code
    window.location.href = result.redirectUrl;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Authorization failed';
    loading.value = false;
  }
}

function deny() {
  // Redirect back with error
  if (redirectUri.value) {
    const url = new URL(redirectUri.value);
    url.searchParams.set('error', 'access_denied');
    if (state.value) url.searchParams.set('state', state.value);
    window.location.href = url.toString();
  }
}
</script>

<template>
  <div class="cpub-oauth-consent">
    <h1 class="cpub-oauth-consent__title">Authorize Access</h1>

    <p class="cpub-oauth-consent__desc">
      An application is requesting access to your account.
    </p>

    <div class="cpub-oauth-consent__details">
      <div class="cpub-oauth-consent__field">
        <span class="cpub-oauth-consent__label">Client</span>
        <span class="cpub-oauth-consent__value">{{ clientId }}</span>
      </div>
      <div v-if="scope" class="cpub-oauth-consent__field">
        <span class="cpub-oauth-consent__label">Scope</span>
        <span class="cpub-oauth-consent__value">{{ scope }}</span>
      </div>
    </div>

    <div v-if="error" class="cpub-oauth-consent__error" role="alert">
      {{ error }}
    </div>

    <div class="cpub-oauth-consent__actions">
      <button
        class="cpub-oauth-consent__btn cpub-oauth-consent__btn--approve"
        :disabled="loading"
        @click="approve"
      >
        {{ loading ? 'Authorizing...' : 'Approve' }}
      </button>
      <button
        class="cpub-oauth-consent__btn cpub-oauth-consent__btn--deny"
        :disabled="loading"
        @click="deny"
      >
        Deny
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-oauth-consent {
  max-width: 420px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  border: 2px solid var(--border);
  background: var(--surface-1);
}

.cpub-oauth-consent__title {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-3);
}

.cpub-oauth-consent__desc {
  color: var(--text-2);
  margin-bottom: var(--space-4);
}

.cpub-oauth-consent__details {
  border: 1px solid var(--border);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.cpub-oauth-consent__field {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
}

.cpub-oauth-consent__label {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  color: var(--text-2);
}

.cpub-oauth-consent__value {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-1);
}

.cpub-oauth-consent__error {
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--error);
  color: var(--error);
  margin-bottom: var(--space-4);
}

.cpub-oauth-consent__actions {
  display: flex;
  gap: var(--space-3);
}

.cpub-oauth-consent__btn {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: 2px solid;
}

.cpub-oauth-consent__btn--approve {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface-1);
}

.cpub-oauth-consent__btn--deny {
  background: transparent;
  border-color: var(--border);
  color: var(--text-2);
}

.cpub-oauth-consent__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
