<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: `Log in — ${useSiteName()}`,
  description: 'Log in to your CommonPub account.',
});

const { signIn } = useAuth();
const { federation } = useFeatures();
const route = useRoute();

const identity = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

// Federated login state
const federatedDomain = ref('');
const federatedLoading = ref(false);
const federatedError = ref('');

// Federated callback context — present when redirected back from OAuth callback.
// Only an opaque linkToken is passed; the verified identity stays server-side.
const federatedLinkToken = computed(() => {
  if (route.query.federated !== 'true') return null;
  return (route.query.linkToken as string) || null;
});

const redirectTo = computed(() => {
  const raw = (route.query.redirect as string) || '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
});

async function handleSubmit(): Promise<void> {
  error.value = '';
  loading.value = true;

  try {
    if (federatedLinkToken.value) {
      // Linking flow: authenticate + link federated account in one step
      await $fetch('/api/auth/federated/link', {
        method: 'POST',
        body: {
          identity: identity.value,
          password: password.value,
          linkToken: federatedLinkToken.value,
        },
        credentials: 'include',
      });
      await navigateTo('/dashboard');
    } else {
      // Normal login flow
      const { email } = await $fetch<{ email: string }>('/api/resolve-identity', {
        method: 'POST',
        body: { identity: identity.value },
      });
      await signIn(email, password.value);
      await navigateTo(redirectTo.value);
    }
  } catch (err: unknown) {
    const fetchErr = err as { statusCode?: number; data?: { message?: string; statusMessage?: string } };
    if (fetchErr?.statusCode === 503) {
      error.value = 'Database unavailable. Make sure PostgreSQL is running.';
    } else {
      error.value = fetchErr?.data?.statusMessage || fetchErr?.data?.message || 'Invalid credentials.';
    }
  } finally {
    loading.value = false;
  }
}

async function handleFederatedLogin(): Promise<void> {
  federatedError.value = '';
  const domain = federatedDomain.value.trim().toLowerCase();
  if (!domain) return;

  federatedLoading.value = true;

  try {
    const result = await $fetch<{ authorizationUrl: string }>('/api/auth/federated/login', {
      method: 'POST',
      body: { instanceDomain: domain },
    });
    // Redirect to the remote instance's OAuth consent page
    window.location.href = result.authorizationUrl;
  } catch (err: unknown) {
    const fetchErr = err as { statusCode?: number; data?: { message?: string; statusMessage?: string } };
    if (fetchErr?.statusCode === 403) {
      federatedError.value = `${domain} is not a trusted instance.`;
    } else if (fetchErr?.statusCode === 502) {
      federatedError.value = `Could not connect to ${domain}. Check the domain and try again.`;
    } else {
      federatedError.value = fetchErr?.data?.statusMessage || fetchErr?.data?.message || 'Failed to initiate federated login.';
    }
  } finally {
    federatedLoading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <h1 class="login-title">Log in</h1>

    <!-- Federated context banner — shown when linking an account -->
    <div v-if="federatedLinkToken" class="cpub-federated-banner" role="status">
      <p class="cpub-federated-banner-text">
        Link your federated identity to a local account.
        Log in below to complete the link.
      </p>
    </div>

    <form class="login-form" @submit.prevent="handleSubmit" aria-label="Login form">
      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

      <div class="field">
        <label for="identity" class="field-label">Username or Email</label>
        <input
          id="identity"
          v-model="identity"
          type="text"
          class="field-input"
          autocomplete="username"
          required
          placeholder="username or email"
        />
      </div>

      <div class="field">
        <label for="password" class="field-label">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="field-input"
          autocomplete="current-password"
          required
          placeholder="Your password"
        />
      </div>

      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading
          ? 'Logging in...'
          : federatedLinkToken
            ? 'Log in & Link Account'
            : 'Log in'
        }}
      </button>

      <NuxtLink to="/auth/forgot-password" class="forgot-link">Forgot your password?</NuxtLink>
    </form>

    <!-- Federated login section — only shown when federation is enabled -->
    <div v-if="federation && !federatedLinkToken" class="cpub-federated-section">
      <div class="cpub-federated-divider">
        <span class="cpub-federated-divider-text">or</span>
      </div>

      <form class="cpub-federated-form" @submit.prevent="handleFederatedLogin" aria-label="Sign in with another instance">
        <div v-if="federatedError" class="form-error" role="alert">{{ federatedError }}</div>

        <label for="federated-domain" class="field-label">Sign in with another instance</label>
        <div class="cpub-federated-input-group">
          <input
            id="federated-domain"
            v-model="federatedDomain"
            type="text"
            class="field-input"
            placeholder="instance.example.com"
            required
            autocomplete="off"
          />
          <button type="submit" class="cpub-federated-btn" :disabled="federatedLoading" aria-label="Sign in with remote instance">
            {{ federatedLoading ? 'Connecting...' : 'Go' }}
          </button>
        </div>
      </form>
    </div>

    <p class="login-footer">
      Don't have an account?
      <NuxtLink to="/auth/register">Register</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
}

.login-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-5);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-error {
  padding: var(--space-3);
  background: var(--red-bg);
  color: var(--red);
  border: var(--border-width-default) solid var(--red);
  border-radius: var(--radius);
  font-size: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

.field-input {
  padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input::placeholder {
  color: var(--text-faint);
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.submit-btn {
  padding: 7px 14px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--accent);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: var(--shadow-md);
  transform: translate(-1px, -1px);
}

.submit-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: var(--space-4);
}

.login-footer a {
  color: var(--accent);
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}

.forgot-link {
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
  text-decoration: none;
  display: block;
}
.forgot-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

/* Federated login */
.cpub-federated-banner {
  padding: var(--space-3);
  background: var(--blue-bg, var(--surface-raised));
  border: var(--border-width-default) solid var(--accent);
  border-radius: var(--radius);
  margin-bottom: var(--space-4);
}

.cpub-federated-banner-text {
  font-size: 13px;
  color: var(--text);
  margin: 0;
  line-height: 1.5;
}

.cpub-federated-banner-text code {
  font-family: var(--font-mono);
  font-size: 12px;
}

.cpub-federated-section {
  margin-top: var(--space-5);
}

.cpub-federated-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.cpub-federated-divider::before,
.cpub-federated-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.cpub-federated-divider-text {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.cpub-federated-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cpub-federated-input-group {
  display: flex;
  gap: var(--space-2);
}

.cpub-federated-input-group .field-input {
  flex: 1;
}

.cpub-federated-btn {
  padding: 7px 14px;
  background: var(--surface-raised);
  color: var(--text);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.cpub-federated-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-federated-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
