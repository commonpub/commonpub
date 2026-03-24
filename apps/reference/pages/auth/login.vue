<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Log in — CommonPub',
  description: 'Log in to your CommonPub account.',
});

const { signIn } = useAuth();
const route = useRoute();

const identity = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const redirectTo = computed(() => {
  const raw = (route.query.redirect as string) || '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
});

async function handleSubmit(): Promise<void> {
  error.value = '';
  loading.value = true;

  try {
    // Step 1: Resolve username to email if needed (server-side)
    const { email } = await $fetch<{ email: string }>('/api/auth/login', {
      method: 'POST',
      body: { identity: identity.value },
    });

    // Step 2: Sign in with Better Auth (sets cookies directly)
    await signIn(email, password.value);
    await navigateTo(redirectTo.value);
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
</script>

<template>
  <div class="login-page">
    <h1 class="login-title">Log in</h1>

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
        {{ loading ? 'Logging in...' : 'Log in' }}
      </button>

      <NuxtLink to="/auth/forgot-password" class="forgot-link">Forgot your password?</NuxtLink>
    </form>

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
  border: 2px solid var(--red);
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
  border: 2px solid var(--border);
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
  border: 2px solid var(--accent);
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
</style>
