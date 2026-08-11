<script setup lang="ts">
/**
 * Soft email verification nag (session 253).
 *
 * The posture: a new user is signed in immediately and never gated, but we still
 * want a confirmed address, so we ask persistently instead of blocking. This is
 * what makes `features.emailVerification` safe to turn on for an instance whose
 * existing accounts are all unverified — nobody is locked out, they are asked.
 *
 * Rendered IN FLOW at the top of the layouts, not as a fixed overlay mounted by
 * the global-overlays plugin like CookieConsent and TermsReacceptanceGate. Those
 * have to escape the layout because they are overlays; a banner does not, and
 * being in flow buys a lot: no z-index to negotiate against the topbar, mobile
 * menu and the sticky contest action bar, no chrome-offset token for every
 * layout to subtract, no DOM-order-vs-visual-order focus bug (the plugin appends
 * its host last in <body>, so a visually-top banner's buttons would be the last
 * tab stops), and no route-based self-suppression — a layout that should not
 * show it simply does not render it.
 *
 * The cost, accepted deliberately: it scrolls away rather than following the
 * viewport, and a fork with its own layout has to include it. deveco is the only
 * such fork and does.
 *
 * SSR-safe: `user` is seeded server-side by plugins/auth.ts and the dismissal
 * cookie is readable during SSR, so this renders identically on both sides and
 * causes no hydration mismatch and no flash.
 */
const { emailVerification } = useFeatures();
const { user, isAuthenticated } = useAuth();
const toast = useToast();

// Session-scoped dismissal: a cookie with no maxAge lives until the browser
// session ends. Deliberately not sessionStorage (per-tab, and invisible to SSR
// so the banner would flash) and not useState (lost on any hard reload).
// Registered in BUILTIN_COOKIES as essential, alongside cpub-color-scheme.
const dismissed = useCookie<string | null>('cpub-verify-dismissed', {
  path: '/',
  sameSite: 'lax',
});

const visible = computed(
  () =>
    emailVerification.value
    && isAuthenticated.value
    && user.value?.emailVerified === false
    && dismissed.value !== '1',
);

const sending = ref(false);
// Sent-state is per page load rather than a cookie: the point is to stop the
// same person clicking four times in a row, not to remember across visits.
const sent = ref(false);

async function resend(): Promise<void> {
  if (sending.value || sent.value) return;
  sending.value = true;
  try {
    await $fetch('/api/user/resend-verification', { method: 'POST' });
    sent.value = true;
    toast.success('Verification email sent. Check your inbox.');
  } catch (err: unknown) {
    // The route answers 429 when someone has already asked three times in the
    // last fifteen minutes. Say so plainly instead of "something went wrong".
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 429) toast.error('Already sent recently. Please wait a few minutes and try again.');
    else toast.error('Could not send the email. Please try again shortly.');
  } finally {
    sending.value = false;
  }
}

function dismiss(): void {
  dismissed.value = '1';
}
</script>

<template>
  <!-- role=status, not role=alert: this is not urgent and must not interrupt a
       screen reader mid-sentence. ARIA 1.2 gives status an implicit polite live
       region, so no explicit aria-live (the house convention, see
       AdminLayoutsAnnouncer). No heading and no banner landmark either: the
       layouts already render <header> as the page's banner, and injecting an
       <h2> here would corrupt every page's outline. -->
  <div v-if="visible" class="cpub-verify-banner" role="status">
    <p class="cpub-verify-banner-text">
      <i class="fa-regular fa-envelope" aria-hidden="true"></i>
      <span v-if="sent">Verification email sent to <strong>{{ user?.email }}</strong>. Check your inbox, and your spam folder.</span>
      <span v-else>Confirm your email address to finish setting up your account. We sent a link to <strong>{{ user?.email }}</strong>.</span>
    </p>
    <div class="cpub-verify-banner-actions">
      <button
        v-if="!sent"
        type="button"
        class="cpub-btn cpub-btn-sm"
        :disabled="sending"
        @click="resend"
      >{{ sending ? 'Sending...' : 'Resend email' }}</button>
      <!-- Self-descriptive out of context: a screen-reader user pulling up a
           list of controls sees what this dismisses, not a bare "Dismiss". -->
      <button
        type="button"
        class="cpub-btn cpub-btn-sm cpub-verify-banner-dismiss"
        aria-label="Dismiss the email confirmation reminder"
        @click="dismiss"
      ><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </div>
  </div>
</template>

<style scoped>
.cpub-verify-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: var(--yellow-bg);
  border: var(--border-width-default) solid var(--yellow-border);
  border-radius: var(--radius);
  margin-bottom: var(--space-4);
}

.cpub-verify-banner-text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  min-width: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
  color: var(--text);
}

.cpub-verify-banner-text i {
  color: var(--yellow-text);
  flex-shrink: 0;
}

.cpub-verify-banner-text strong {
  /* An address is unbreakable and long; without this it blows out the row at
     390px, which is the width most of these are read at. */
  overflow-wrap: anywhere;
}

.cpub-verify-banner-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.cpub-verify-banner-dismiss {
  /* Icon-only, so pin the width to keep the 44px target square rather than
     letting the glyph collapse it. */
  min-width: 44px;
  justify-content: center;
}

@media (max-width: 640px) {
  .cpub-verify-banner {
    align-items: stretch;
  }
  .cpub-verify-banner-actions {
    width: 100%;
  }
  .cpub-verify-banner-actions .cpub-btn:not(.cpub-verify-banner-dismiss) {
    flex: 1;
    justify-content: center;
  }
}

/* No print stylesheet exists in the monorepo, so carry our own: a nag has no
   business on paper. */
@media print {
  .cpub-verify-banner {
    display: none;
  }
}
</style>
