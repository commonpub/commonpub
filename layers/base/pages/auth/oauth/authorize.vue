<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  // No middleware: 'auth' — this page must be accessible to unauthenticated users
  // arriving from remote instances during federated OAuth login
});

useHead({ title: 'Authorize Application' });

const route = useRoute();
const { isAuthenticated, signIn } = useAuth();

const clientId = computed(() => route.query.client_id as string ?? '');
const redirectUri = computed(() => route.query.redirect_uri as string ?? '');
const responseType = computed(() => route.query.response_type as string ?? '');
const scope = computed(() => route.query.scope as string ?? '');
const state = computed(() => route.query.state as string ?? '');

const loading = ref(false);
const error = ref<string | null>(null);

// Login form state (shown when not authenticated)
const loginEmail = ref('');
const loginPassword = ref('');
const loginLoading = ref(false);
const loginError = ref<string | null>(null);

async function handleLogin() {
  loginLoading.value = true;
  loginError.value = null;
  try {
    await signIn(loginEmail.value, loginPassword.value);
    // After login, stay on this page — consent form will appear
  } catch (err: unknown) {
    loginError.value = err instanceof Error ? err.message : 'Login failed';
  } finally {
    loginLoading.value = false;
  }
}

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

// Extract requesting domain from client_id for display
const requestingDomain = computed(() => {
  const id = clientId.value;
  if (id.startsWith('cpub_')) return id.slice(5);
  try { return new URL(id).hostname; } catch { return id; }
});
</script>

<template>
  <div class="cpub-oauth-consent">
    <!-- Unauthenticated: show login form with context -->
    <template v-if="!isAuthenticated">
      <h1 class="cpub-oauth-consent__title">Sign in to Continue</h1>

      <p class="cpub-oauth-consent__desc">
        <strong>{{ requestingDomain }}</strong> is requesting access to your account.
        Sign in to review and approve this request.
      </p>

      <form class="cpub-oauth-login-form" @submit.prevent="handleLogin">
        <div v-if="loginError" class="cpub-oauth-consent__error" role="alert">
          {{ loginError }}
        </div>

        <label class="cpub-oauth-login-label">
          <span>Email</span>
          <input
            v-model="loginEmail"
            type="email"
            autocomplete="email"
            required
            class="cpub-oauth-login-input"
          />
        </label>

        <label class="cpub-oauth-login-label">
          <span>Password</span>
          <input
            v-model="loginPassword"
            type="password"
            autocomplete="current-password"
            required
            class="cpub-oauth-login-input"
          />
        </label>

        <button
          type="submit"
          class="cpub-oauth-consent__btn cpub-oauth-consent__btn--approve"
          :disabled="loginLoading"
        >
          {{ loginLoading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <p class="cpub-oauth-login-alt">
        Don't have an account? <NuxtLink :to="`/auth/register?redirect=${encodeURIComponent(route.fullPath)}`">Sign up</NuxtLink>
      </p>
    </template>

    <!-- Authenticated: show consent form -->
    <template v-else>
      <h1 class="cpub-oauth-consent__title">Authorize Access</h1>

      <p class="cpub-oauth-consent__desc">
        <strong>{{ requestingDomain }}</strong> is requesting access to your account.
      </p>

      <div class="cpub-oauth-consent__details">
        <div class="cpub-oauth-consent__field">
          <span class="cpub-oauth-consent__label">Instance</span>
          <span class="cpub-oauth-consent__value">{{ requestingDomain }}</span>
        </div>
        <div v-if="scope" class="cpub-oauth-consent__field">
          <span class="cpub-oauth-consent__label">Scope</span>
          <span class="cpub-oauth-consent__value">{{ scope }}</span>
        </div>
      </div>

      <p class="cpub-oauth-consent__permissions">
        This will allow <strong>{{ requestingDomain }}</strong> to verify your identity and access your public profile information.
      </p>

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
    </template>
  </div>
</template>

<style scoped>
.cpub-oauth-consent {
  max-width: 420px;
  margin: var(--space-8) auto;
  padding: var(--space-6);
  border: var(--border-width-default) solid var(--border);
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
  border: var(--border-width-default) solid var(--border);
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

.cpub-oauth-consent__permissions {
  color: var(--text-2);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  border: var(--border-width-default) solid var(--border);
}

.cpub-oauth-consent__error {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-default) solid var(--error);
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
  border: var(--border-width-default) solid;
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

/* Login form styles */
.cpub-oauth-login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.cpub-oauth-login-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-2);
}

.cpub-oauth-login-input {
  padding: var(--space-2);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-1);
  font-size: var(--font-size-base);
}

.cpub-oauth-login-input:focus {
  border-color: var(--accent);
  outline: none;
}

.cpub-oauth-login-alt {
  font-size: var(--font-size-sm);
  color: var(--text-2);
  text-align: center;
}

.cpub-oauth-login-alt a {
  color: var(--accent);
}
</style>
