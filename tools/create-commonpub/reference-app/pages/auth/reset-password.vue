<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Reset Password — CommonPub',
  description: 'Set a new password for your CommonPub account.',
});

const route = useRoute();
const token = computed(() => (route.query.token as string) || '');

const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const success = ref(false);
const loading = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = '';

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  if (!token.value) {
    error.value = 'Invalid or expired reset link.';
    return;
  }

  loading.value = true;

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, newPassword: password.value },
    });
    success.value = true;
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message;
    error.value = message || 'Failed to reset password. The link may have expired.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="reset-page">
    <h1 class="reset-title">Reset Password</h1>

    <template v-if="success">
      <div class="reset-success">
        <i class="fa-solid fa-check-circle" style="font-size: 24px; color: var(--green); margin-bottom: 12px;"></i>
        <p class="reset-success-text">Your password has been reset successfully.</p>
      </div>
      <NuxtLink to="/auth/login" class="back-link">
        <i class="fa-solid fa-arrow-right"></i> Go to login
      </NuxtLink>
    </template>

    <template v-else>
      <p class="reset-desc">Enter your new password below.</p>

      <form class="reset-form" @submit.prevent="handleSubmit" aria-label="Reset password form">
        <div v-if="error" class="form-error" role="alert">{{ error }}</div>

        <div class="field">
          <label for="password" class="field-label">New Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="field-input"
            autocomplete="new-password"
            required
            placeholder="At least 8 characters"
            minlength="8"
          />
        </div>

        <div class="field">
          <label for="confirm" class="field-label">Confirm Password</label>
          <input
            id="confirm"
            v-model="confirmPassword"
            type="password"
            class="field-input"
            autocomplete="new-password"
            required
            placeholder="Confirm your password"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.reset-page { width: 100%; }
.reset-title { font-size: 18px; font-weight: 600; margin-bottom: var(--space-3); }
.reset-desc { font-size: 13px; color: var(--text-dim); margin-bottom: var(--space-5); line-height: 1.6; }
.reset-form { display: flex; flex-direction: column; gap: var(--space-4); }
.reset-success { text-align: center; padding: var(--space-5) 0; }
.reset-success-text { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
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
</style>
