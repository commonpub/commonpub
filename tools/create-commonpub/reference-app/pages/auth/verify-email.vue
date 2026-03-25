<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: 'Verify Email — CommonPub',
  description: 'Verify your CommonPub email address.',
});

const route = useRoute();
const token = computed(() => (route.query.token as string) || '');

const status = ref<'verifying' | 'success' | 'error' | 'no-token'>('verifying');
const errorMessage = ref('');

if (!token.value) {
  status.value = 'no-token';
} else {
  onMounted(async () => {
    try {
      await $fetch('/api/auth/verify-email', {
        method: 'POST',
        body: { token: token.value },
      });
      status.value = 'success';
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      errorMessage.value = message || 'Verification failed. The link may have expired.';
      status.value = 'error';
    }
  });
}
</script>

<template>
  <div class="verify-page">
    <h1 class="verify-title">Email Verification</h1>

    <!-- Verifying -->
    <div v-if="status === 'verifying'" class="verify-status">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: var(--accent); margin-bottom: 12px;"></i>
      <p class="verify-text">Verifying your email address...</p>
    </div>

    <!-- Success -->
    <div v-else-if="status === 'success'" class="verify-status">
      <i class="fa-solid fa-check-circle" style="font-size: 24px; color: var(--green); margin-bottom: 12px;"></i>
      <p class="verify-text">Your email has been verified successfully!</p>
      <NuxtLink to="/auth/login" class="verify-link">
        <i class="fa-solid fa-arrow-right"></i> Continue to login
      </NuxtLink>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="verify-status">
      <i class="fa-solid fa-circle-xmark" style="font-size: 24px; color: var(--red); margin-bottom: 12px;"></i>
      <p class="verify-text">{{ errorMessage }}</p>
      <NuxtLink to="/auth/login" class="verify-link">
        <i class="fa-solid fa-arrow-left"></i> Back to login
      </NuxtLink>
    </div>

    <!-- No token -->
    <div v-else class="verify-status">
      <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; color: var(--yellow); margin-bottom: 12px;"></i>
      <p class="verify-text">No verification token found. Please check the link in your email.</p>
      <NuxtLink to="/auth/login" class="verify-link">
        <i class="fa-solid fa-arrow-left"></i> Back to login
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.verify-page { width: 100%; }
.verify-title { font-size: 18px; font-weight: 600; margin-bottom: var(--space-5); }
.verify-status { text-align: center; padding: var(--space-5) 0; display: flex; flex-direction: column; align-items: center; }
.verify-text { font-size: 13px; color: var(--text-dim); line-height: 1.6; max-width: 300px; }
.verify-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; margin-top: var(--space-4); }
.verify-link:hover { text-decoration: underline; }
</style>
