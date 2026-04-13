<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: `Reset Password — ${useSiteName()}`,
  description: 'Set a new password for your CommonPub account.',
});

const route = useRoute();
const token = computed(() => (route.query.token as string) || '');
const tokenError = computed(() => (route.query.error as string) || '');

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
  <div class="cpub-reset-page">
    <h1 class="cpub-reset-title">Reset Password</h1>

    <template v-if="success">
      <div class="cpub-reset-success">
        <i class="fa-solid fa-check-circle" style="font-size: 24px; color: var(--green); margin-bottom: 12px;"></i>
        <p class="cpub-reset-success-text">Your password has been reset successfully.</p>
      </div>
      <NuxtLink to="/auth/login" class="cpub-back-link">
        <i class="fa-solid fa-arrow-right"></i> Go to login
      </NuxtLink>
    </template>

    <template v-else-if="tokenError">
      <div class="cpub-reset-error-state">
        <i class="fa-solid fa-circle-xmark" style="font-size: 24px; color: var(--red); margin-bottom: 12px;"></i>
        <p class="cpub-reset-success-text">This reset link is invalid or has expired.</p>
      </div>
      <NuxtLink to="/auth/forgot-password" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> Request a new link
      </NuxtLink>
    </template>

    <template v-else>
      <p class="cpub-reset-desc">Enter your new password below.</p>

      <form class="cpub-reset-form" @submit.prevent="handleSubmit" aria-label="Reset password form">
        <div v-if="error" class="cpub-form-error" role="alert">{{ error }}</div>

        <div class="cpub-field">
          <label for="password" class="cpub-field-label">New Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="cpub-field-input"
            autocomplete="new-password"
            required
            placeholder="At least 8 characters"
            minlength="8"
          />
        </div>

        <div class="cpub-field">
          <label for="confirm" class="cpub-field-label">Confirm Password</label>
          <input
            id="confirm"
            v-model="confirmPassword"
            type="password"
            class="cpub-field-input"
            autocomplete="new-password"
            required
            placeholder="Confirm your password"
          />
        </div>

        <button type="submit" class="cpub-submit-btn" :disabled="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.cpub-reset-page { width: 100%; }
.cpub-reset-title { font-size: 18px; font-weight: 600; margin-bottom: var(--space-3); }
.cpub-reset-desc { font-size: 13px; color: var(--text-dim); margin-bottom: var(--space-5); line-height: 1.6; }
.cpub-reset-form { display: flex; flex-direction: column; gap: var(--space-4); }
.cpub-reset-success { text-align: center; padding: var(--space-5) 0; }
.cpub-reset-success-text { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
.cpub-back-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; justify-content: center; margin-top: var(--space-4); }
.cpub-back-link:hover { text-decoration: underline; }
.cpub-form-error { padding: var(--space-3); background: var(--red-bg); color: var(--red); border: var(--border-width-default) solid var(--red); border-radius: var(--radius); font-size: 12px; }
.cpub-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-field-label { font-size: 12px; font-weight: 500; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); }
.cpub-field-input { padding: 8px 12px; border: var(--border-width-default) solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 13px; font-family: var(--font-sans); outline: none; width: 100%; transition: border-color 0.15s; }
.cpub-field-input::placeholder { color: var(--text-faint); }
.cpub-field-input:focus { border-color: var(--accent); }
.cpub-submit-btn { padding: 7px 14px; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent); border-radius: var(--radius); font-size: 13px; font-weight: 500; cursor: pointer; box-shadow: var(--shadow-sm); transition: all 0.15s; }
.cpub-submit-btn:hover:not(:disabled) { box-shadow: var(--shadow-md); transform: translate(-1px, -1px); }
.cpub-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.cpub-reset-error-state { text-align: center; padding: var(--space-5) 0; }
</style>
