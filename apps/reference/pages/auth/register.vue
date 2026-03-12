<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Register — CommonPub',
  description: 'Create your CommonPub account.',
});

const username = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = '';
  loading.value = true;

  try {
    const response = await $fetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        name: username.value,
        username: username.value,
        email: email.value,
        password: password.value,
      },
    });

    if (response) {
      await navigateTo('/');
    }
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
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  margin-bottom: var(--space-6);
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
  border: var(--border-width-default) solid var(--red);
  border-radius: var(--radius);
  font-size: var(--text-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text);
}

.field-input {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-base);
  font-family: var(--font-sans);
}

.field-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.submit-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.submit-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-lg);
}

.submit-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: var(--shadow-sm);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register-footer {
  text-align: center;
  font-size: var(--text-sm);
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
