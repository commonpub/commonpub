<script setup lang="ts">
definePageMeta({ layout: 'auth' });

useSeoMeta({
  title: `Register, ${useSiteName()}`,
  description: 'Create your CommonPub account.',
});

const { signUp } = useAuth();
const { referralLinks: referralEnabled } = useFeatures();
const route = useRoute();

// Referral capture (session 229). `?ref=<code>` is shown as an "invited by"
// banner; the same code is forwarded to the claim endpoint after signup. When a
// user arrives via /r/:code without ?ref, the cookie carries the code and the
// claim endpoint / backstop middleware picks it up server-side.
const refCode = computed(() => {
  const r = route.query.ref;
  return typeof r === 'string' ? r : '';
});
const referral = ref<{ ownerUsername: string; ownerDisplayName: string | null; label: string | null; hubNames: string[] } | null>(null);

onMounted(async () => {
  if (!refCode.value || !referralEnabled.value) return;
  try {
    const res = await $fetch<{ referral: typeof referral.value }>('/api/referrals/resolve', { query: { code: refCode.value } });
    referral.value = res?.referral ?? null;
  } catch { /* banner is optional */ }
});

const username = ref('');
const email = ref('');
const password = ref('');
const agreed = ref(false);
const error = ref('');
const loading = ref(false);
const registered = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = '';
  // Affirmative consent (GDPR): the button is disabled until checked, but guard
  // here too in case of a programmatic submit.
  if (!agreed.value) {
    error.value = 'Please accept the Terms of Service and Code of Conduct to continue.';
    return;
  }
  loading.value = true;

  try {
    await signUp(email.value, password.value, username.value);
    const { user: authUser } = useAuth();
    if (authUser.value && !authUser.value.emailVerified) {
      // Email verification required — show the check-your-email message
      registered.value = true;
      return;
    }
    // Claim the referral (if any) and prefer its destination, e.g. the hub the
    // new member was just auto-joined to. Best-effort: the backstop middleware
    // covers a failure or a closed tab.
    let target = (route.query.redirect as string) || '';
    if (referralEnabled.value) {
      try {
        const res = await $fetch<{ destination: string | null }>('/api/referrals/claim', {
          method: 'POST',
          body: { code: refCode.value || undefined },
        });
        if (res?.destination) target = res.destination;
      } catch { /* best-effort */ }
    }
    // Prevent open redirect — only allow relative paths
    const redirect = (target.startsWith('/') && !target.startsWith('//')) ? target : '/dashboard';
    await navigateTo(redirect);
    return;
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
    <!-- Email verification message -->
    <div v-if="registered" class="register-success">
      <div class="register-success-icon"><i class="fa-solid fa-envelope-circle-check"></i></div>
      <h1 class="register-title">Check your email</h1>
      <p class="register-success-msg">
        We sent a verification link to <strong>{{ email }}</strong>. Click the link to activate your account.
      </p>
      <NuxtLink to="/auth/login" class="submit-btn" style="display: inline-block; text-align: center; text-decoration: none; margin-top: 16px;">
        Go to Login
      </NuxtLink>
    </div>

    <template v-else>
    <h1 class="register-title">Create account</h1>

    <div v-if="referral" class="register-invite" role="note">
      <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
      <span>
        Invited by <strong>{{ referral.ownerDisplayName || referral.ownerUsername }}</strong>.
        <template v-if="referral.hubNames.length">
          You'll join {{ referral.hubNames.join(', ') }} when you sign up.
        </template>
      </span>
    </div>

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
          minlength="8"
          placeholder="Choose a password (min. 8 characters)"
        />
      </div>

      <label class="register-consent">
        <input v-model="agreed" type="checkbox" class="register-consent-box" required />
        <span>
          I agree to the
          <NuxtLink to="/terms">Terms of Service and Code of Conduct</NuxtLink>
          and acknowledge the
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
        </span>
      </label>

      <button type="submit" class="submit-btn" :disabled="loading || !agreed">
        {{ loading ? 'Creating...' : 'Create account' }}
      </button>
    </form>

    <p class="register-footer">
      Already have an account?
      <NuxtLink to="/auth/login">Log in</NuxtLink>
    </p>
    </template>
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

.register-invite {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: var(--space-3);
  margin-bottom: var(--space-4);
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
}

.register-invite i {
  color: var(--accent);
  margin-top: 2px;
}

.register-invite strong {
  color: var(--text);
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-error {
  padding: var(--space-3);
  background: var(--red-bg);
  color: var(--red-text);
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

.register-consent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.5;
  cursor: pointer;
}

.register-consent-box {
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: var(--accent);
}

.register-consent a {
  color: var(--accent);
  text-decoration: none;
}

.register-consent a:hover {
  text-decoration: underline;
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

.register-success {
  text-align: center;
  padding: 16px 0;
}

.register-success-icon {
  font-size: 36px;
  color: var(--green-text);
  margin-bottom: 16px;
}

.register-success-msg {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
  margin-top: 8px;
}

.register-success-msg strong {
  color: var(--text);
}
</style>
