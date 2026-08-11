<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: `Verify Email, ${useSiteName()}`,
  description: 'Verify your CommonPub email address.',
});

const route = useRoute();
const token = computed(() => (route.query.token as string) || '');
const { isAuthenticated, refreshSession } = useAuth();
const toast = useToast();

const status = ref<'verifying' | 'success' | 'error' | 'no-token'>('verifying');
const errorMessage = ref('');

if (!token.value) {
  status.value = 'no-token';
} else {
  onMounted(async () => {
    try {
      // Better Auth exposes /verify-email as GET reading `token` from the QUERY.
      // With no callbackURL it returns JSON {status:true} instead of redirecting,
      // so the branded page can render its own success/error UI. (A POST body — the
      // previous call — matched no route and always failed.)
      await $fetch('/api/auth/verify-email', {
        method: 'GET',
        query: { token: token.value },
      });
      status.value = 'success';
      // Under soft verification the visitor is usually ALREADY signed in (signup
      // does not gate them), and their cached session user still says
      // emailVerified:false — so without this the nag banner would survive the
      // very click that resolved it. The DB row is already updated server-side;
      // this just re-reads it.
      if (isAuthenticated.value) await refreshSession();
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message;
      errorMessage.value = message || 'Verification failed. The link may have expired.';
      status.value = 'error';
    }
  });
}

// Resend from the error branch — the common case is an expired link, and the
// token is only valid for an hour. Session-only: the endpoint takes the address
// from the session, so it has nothing to act on for an anonymous visitor.
const resending = ref(false);
const resent = ref(false);
async function resend(): Promise<void> {
  if (resending.value || resent.value) return;
  resending.value = true;
  try {
    await $fetch('/api/user/resend-verification', { method: 'POST' });
    resent.value = true;
    toast.success('New verification email sent. Check your inbox.');
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 429) toast.error('Already sent recently. Please wait a few minutes and try again.');
    else toast.error('Could not send the email. Please try again shortly.');
  } finally {
    resending.value = false;
  }
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
      <i class="fa-solid fa-check-circle" style="font-size: 24px; color: var(--green-text); margin-bottom: 12px;"></i>
      <p class="verify-text">Your email has been verified successfully!</p>
      <!-- Under soft verification the visitor is normally already signed in, so
           sending them to a login form is a dead end. -->
      <NuxtLink v-if="isAuthenticated" to="/dashboard" class="verify-link">
        <i class="fa-solid fa-arrow-right"></i> Continue to your dashboard
      </NuxtLink>
      <NuxtLink v-else to="/auth/login" class="verify-link">
        <i class="fa-solid fa-arrow-right"></i> Continue to login
      </NuxtLink>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="verify-status">
      <i class="fa-solid fa-circle-xmark" style="font-size: 24px; color: var(--red-text); margin-bottom: 12px;"></i>
      <p class="verify-text">{{ errorMessage }}</p>
      <!-- Links expire after an hour, so the useful action here is a new one,
           not a trip back to a login form. -->
      <button
        v-if="isAuthenticated && !resent"
        type="button"
        class="cpub-btn cpub-btn-sm"
        :disabled="resending"
        @click="resend"
      >{{ resending ? 'Sending...' : 'Send a new link' }}</button>
      <p v-else-if="resent" class="verify-text">A new link is on its way. Check your inbox.</p>
      <NuxtLink v-if="!isAuthenticated" to="/auth/login" class="verify-link">
        <i class="fa-solid fa-arrow-left"></i> Back to login
      </NuxtLink>
    </div>

    <!-- No token -->
    <div v-else class="verify-status">
      <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; color: var(--yellow-text); margin-bottom: 12px;"></i>
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
