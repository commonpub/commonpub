<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: `Log in — ${useSiteName()}`,
  description: 'Log in to your CommonPub account.',
});

const { signIn, refreshSession } = useAuth();
const { federation, identity: identityFeatures } = useFeatures();
const route = useRoute();

const identity = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

// CommonPub-to-CommonPub (v1 SSO) state — `features.federation` gate
const federatedDomain = ref('');
const federatedLoading = ref(false);
const federatedError = ref('');

// Mastodon-API login state (Phase 2b) — `features.identity.signInWithRemote` gate.
// Accepts `@user@host`, `user@host`, or bare `host` (no leading @).
// On submit, parses out the host and redirects to /api/auth/mastodon/start.
const mastodonHandle = ref('');
const mastodonError = ref('');

// Surface server-side errors redirected back from the callback (?mastodon_error=...)
onMounted(() => {
  const queryErr = route.query.mastodon_error;
  if (typeof queryErr === 'string' && queryErr) mastodonError.value = queryErr;
});

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
      // Normal login flow — username→email resolved server-side
      await $fetch('/api/auth/sign-in-username', {
        method: 'POST',
        body: { identity: identity.value, password: password.value },
        credentials: 'include',
      });
      await refreshSession();
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

/**
 * Parse a handle string into a host. Accepts:
 *   - `@user@mastodon.social`  → mastodon.social
 *   - `user@mastodon.social`   → mastodon.social
 *   - `acct:user@mastodon.social` → mastodon.social
 *   - bare `mastodon.social`   → mastodon.social
 * Returns null for anything that doesn't look like a host (e.g., bare username, email).
 */
function extractHost(input: string): string | null {
  const trimmed = input.trim().replace(/^acct:/i, '');
  if (!trimmed) return null;
  // user@host shape (with or without leading @)
  const stripped = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const atIdx = stripped.indexOf('@');
  if (atIdx > 0 && atIdx === stripped.lastIndexOf('@')) {
    const host = stripped.slice(atIdx + 1).toLowerCase();
    return isHostShape(host) ? host : null;
  }
  // Bare host (no @ anywhere, must contain a dot)
  if (atIdx === -1 && stripped.includes('.')) {
    return isHostShape(stripped.toLowerCase());
  }
  return null;
}

function isHostShape(host: string): string | null {
  if (!host || host.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/i.test(host)) return null;
  if (!host.includes('.')) return null;
  return host;
}

function handleMastodonLogin(): void {
  mastodonError.value = '';
  const host = extractHost(mastodonHandle.value);
  if (!host) {
    mastodonError.value = 'Enter a handle like @user@mastodon.social or just mastodon.social';
    return;
  }
  // The start route is a GET that redirects to the remote's /oauth/authorize.
  // Use window.location.href so the browser actually navigates (and cookies
  // for the eventual callback land correctly).
  const params = new URLSearchParams({ host });
  if (redirectTo.value && redirectTo.value !== '/') params.set('returnTo', redirectTo.value);
  window.location.href = `/api/auth/mastodon/start?${params.toString()}`;
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

    <!-- v1 SSO federation section — gated by features.federation; CommonPub-only via trustedInstances -->
    <div v-if="federation && !federatedLinkToken" class="cpub-federated-section">
      <div class="cpub-federated-divider">
        <span class="cpub-federated-divider-text">or</span>
      </div>

      <form class="cpub-federated-form" @submit.prevent="handleFederatedLogin" aria-label="Sign in with another CommonPub instance">
        <div v-if="federatedError" class="form-error" role="alert">{{ federatedError }}</div>

        <label for="federated-domain" class="field-label">Sign in with another CommonPub instance</label>
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
          <button type="submit" class="cpub-federated-btn" :disabled="federatedLoading" aria-label="Sign in with remote CommonPub instance">
            {{ federatedLoading ? 'Connecting...' : 'Go' }}
          </button>
        </div>
      </form>
    </div>

    <!--
      Mastodon-API login section (Phase 2b) — gated by features.identity.signInWithRemote.
      Works with any Mastodon-API-compatible host: Mastodon, Pleroma, Akkoma, GoToSocial,
      Firefish, and other CommonPub instances. On submit, parses the input to extract a
      host and navigates to /api/auth/mastodon/start, which registers our OAuth client at
      the remote and redirects the user to their authorize page.
    -->
    <div v-if="identityFeatures.signInWithRemote && !federatedLinkToken" class="cpub-federated-section">
      <div class="cpub-federated-divider">
        <span class="cpub-federated-divider-text">or</span>
      </div>

      <form class="cpub-federated-form" @submit.prevent="handleMastodonLogin" aria-label="Sign in with Mastodon or any Fediverse instance">
        <div v-if="mastodonError" class="form-error" role="alert">{{ mastodonError }}</div>

        <label for="mastodon-handle" class="field-label">
          Sign in with Mastodon
          <span class="field-label-note">— or Pleroma, GoToSocial, Akkoma, Firefish</span>
        </label>
        <div class="cpub-federated-input-group">
          <input
            id="mastodon-handle"
            v-model="mastodonHandle"
            type="text"
            class="field-input"
            placeholder="@user@mastodon.social or mastodon.social"
            autocomplete="off"
            inputmode="email"
            spellcheck="false"
            autocapitalize="off"
          />
          <button type="submit" class="cpub-federated-btn" aria-label="Sign in with Fediverse instance">
            Sign in
          </button>
        </div>
        <p class="cpub-federated-hint">
          You'll be redirected to your home instance to confirm. No new password needed.
        </p>
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

.field-label-note {
  font-weight: 400;
  font-family: var(--font-sans);
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-faint);
  font-size: 11px;
}

.cpub-federated-hint {
  font-size: 11px;
  color: var(--text-faint);
  margin: 4px 0 0 0;
  line-height: 1.4;
}
</style>
