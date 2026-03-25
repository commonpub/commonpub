<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Forgot Password — CommonPub',
  description: 'Reset your CommonPub account password.',
});

const email = ref('');
const error = ref('');
const success = ref(false);
const loading = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = '';
  loading.value = true;

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    });
    success.value = true;
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message;
    error.value = message || 'Something went wrong. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="forgot-page">
    <h1 class="forgot-title">Forgot Password</h1>

    <template v-if="success">
      <div class="forgot-success">
        <i class="fa-solid fa-envelope" style="font-size: 24px; color: var(--accent); margin-bottom: 12px;"></i>
        <p class="forgot-success-text">
          If an account exists for <strong>{{ email }}</strong>, we've sent a password reset link.
          Check your inbox and spam folder.
        </p>
      </div>
      <NuxtLink to="/auth/login" class="back-link">
        <i class="fa-solid fa-arrow-left"></i> Back to login
      </NuxtLink>
    </template>

    <template v-else>
      <p class="forgot-desc">Enter your email address and we'll send you a link to reset your password.</p>

      <form class="forgot-form" @submit.prevent="handleSubmit" aria-label="Forgot password form">
        <div v-if="error" class="form-error" role="alert">{{ error }}</div>

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

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>

      <p class="forgot-footer">
        Remember your password?
        <NuxtLink to="/auth/login">Log in</NuxtLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.forgot-page { width: 100%; }
.forgot-title { font-size: 18px; font-weight: 600; margin-bottom: var(--space-3); }
.forgot-desc { font-size: 13px; color: var(--text-dim); margin-bottom: var(--space-5); line-height: 1.6; }
.forgot-form { display: flex; flex-direction: column; gap: var(--space-4); }
.forgot-success { text-align: center; padding: var(--space-5) 0; }
.forgot-success-text { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
.back-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; justify-content: center; margin-top: var(--space-4); }
.back-link:hover { text-decoration: underline; }
.form-error { padding: var(--space-3); background: var(--red-bg); color: var(--red); border: 2px solid var(--red); border-radius: var(--radius); font-size: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; font-weight: 500; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); }
.field-input { padding: 8px 12px; border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 13px; font-family: var(--font-sans); outline: none; width: 100%; transition: border-color 0.15s; }
.field-input::placeholder { color: var(--text-faint); }
.field-input:focus { border-color: var(--accent); }
.submit-btn { padding: 7px 14px; background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--accent); border-radius: var(--radius); font-size: 13px; font-weight: 500; cursor: pointer; box-shadow: var(--shadow-sm); transition: all 0.15s; }
.submit-btn:hover:not(:disabled) { box-shadow: var(--shadow-md); transform: translate(-1px, -1px); }
.submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.forgot-footer { text-align: center; font-size: 12px; color: var(--text-dim); margin-top: var(--space-4); }
.forgot-footer a { color: var(--accent); text-decoration: none; }
.forgot-footer a:hover { text-decoration: underline; }
</style>
