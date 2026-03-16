<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Register — CommonPub',
  description: 'Create your CommonPub account.',
});

const { signUp } = useAuth();

const username = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = '';
  loading.value = true;

  try {
    await signUp(email.value, password.value, username.value);
    await navigateTo('/');
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message;
    error.value = message || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="register-page">
    <h1 class="register-title">Create account</h1>

    <form class="register-form" @submit.prevent="handleSubmit" aria-label="Registration form">
      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

      <div class="field">
        <label for="username" class="field-label">Username</label>
        <input
          id="username"
          v-model="username"
          type="text"
          class="field-input"
          autocomplete="username"
          required
          placeholder="your-username"
        />
      </div>

      <div class="field">
        <label for="email" class="field-label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="field-input"
          autocomplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div class="field">
        <label for="password" class="field-label">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="field-input"
          autocomplete="new-password"
          required
          placeholder="Choose a password"
        />
      </div>

      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? 'Creating...' : 'Create account' }}
      </button>
    </form>

    <p class="register-footer">
      Already have an account?
      <NuxtLink to="/auth/login">Log in</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.register-page {
  width: 100%;
}

.register-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-5);
}

.register-form {
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

.register-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: var(--space-4);
}

.register-footer a {
  color: var(--accent);
  text-decoration: none;
}

.register-footer a:hover {
  text-decoration: underline;
}
</style>
