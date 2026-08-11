<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';

/**
 * Persistent contest action bar for narrow viewports (session 253).
 *
 * The problem it solves, measured on the live deveco contest: the page is
 * 9,865px tall on a 390px screen, the sidebar registration card is the last
 * grid child and lands at ~92% of DOM depth, and nothing on the page is sticky.
 * A call to action appeared once at y=590 and then not again for ~9,000px, so
 * for 89% of the page there was nothing to press.
 *
 * MOBILE ONLY, by design. On desktop the same problem is solved for free by
 * making the sidebar sticky (one CSS rule on the page), which keeps the real
 * registration card on screen — a far better affordance than a duplicate button
 * strip. Restricting this to <=768px also means it never has to negotiate the
 * topbar offset (whose token deveco does not override, so it is 12px wrong
 * there), never collides with the verification banner, and never shows two
 * identical primary buttons at once.
 *
 * SSR: renders the anonymous/unregistered state, which is correct for the
 * majority visitor. `registrationTier` is deliberately client-only (per-viewer
 * state must not be baked into cacheable HTML), so the label swaps in after
 * hydration. The bar's height is fixed and it is `position: fixed`, so that swap
 * can never shift the page.
 */
type Tier = 'full' | 'reminders';

const props = defineProps<{
  contest: Serialized<ContestDetail> | null;
  isAuthenticated?: boolean;
  /** Viewer's tier. Client-only — null through SSR and the first render. */
  registrationTier?: Tier | null;
  /** In-flight register/unregister (disables the primary). */
  registering?: boolean;
  /** Viewer can edit this contest (organizer/admin). */
  canManage?: boolean;
  /** Viewer is an accepted, scoring judge. */
  canJudge?: boolean;
}>();

const emit = defineEmits<{
  (e: 'register'): void;
  (e: 'follow'): void;
  (e: 'submit-entry'): void;
  (e: 'copy-link'): void;
}>();

const status = computed(() => props.contest?.status ?? '');
const slug = computed(() => props.contest?.slug ?? '');
const isFull = computed(() => props.registrationTier === 'full');
const isFollowing = computed(() => props.registrationTier === 'reminders');

// Mirrors the server's REGISTERABLE_STATUSES and the signup card.
const canRegister = computed(() => status.value === 'upcoming' || status.value === 'active');
const isOver = computed(() => status.value === 'completed' || status.value === 'cancelled');

// A draft has no audience yet, and a judge sitting on an unaccepted invite has
// exactly one thing to do (the invite banner in the body) which this must not
// compete with.
//
// hasPrimary mirrors the template's branch chain. Without it the bar rendered a
// share-only strip — plus ~60px of reserved body padding — for `judging`
// (a weeks-long state), `paused` and `cancelled`, i.e. a permanent band of
// chrome offering nothing. A bar with no primary action is worse than no bar.
const hasPrimary = computed(() => {
  if (props.canManage) return true;
  if (props.canJudge && status.value === 'judging') return true;
  if (status.value === 'completed') return true;
  if (status.value === 'cancelled') return false;
  if (isFull.value) return status.value === 'active' || canRegister.value;
  return canRegister.value;
});

const shouldRender = computed(
  () => !!props.contest && status.value !== 'draft' && hasPrimary.value,
);

// Anonymous register goes through login and lands IN the registration form; the
// shared resolver owns that decision for every CTA on the page.
const loginTo = computed(
  () => `/auth/login?redirect=/contests/${slug.value}/register`,
);

// Publish the bar's real height so the page can reserve exactly that much and
// the footer stays reachable. Measured rather than hardcoded: the height varies
// with the safe-area inset, the font scale, and whether the labels wrap — a
// literal 60px under-reserved by 25px on the first device tested. Set on <html>
// because the consumer is a `body:has(...)` rule.
const root = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;

function publishHeight(px: number): void {
  document.documentElement.style.setProperty('--cpub-contest-actions-h', `${Math.ceil(px)}px`);
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !root.value) return;
  ro = new ResizeObserver(([entry]) => {
    // 0 while the bar is display:none above 768px — leave the last good value
    // rather than collapsing the reservation mid-resize.
    const h = entry.target.getBoundingClientRect().height;
    if (h > 0) publishHeight(h);
    else document.documentElement.style.removeProperty('--cpub-contest-actions-h');
  });
  ro.observe(root.value);
});

onUnmounted(() => {
  ro?.disconnect();
  document.documentElement.style.removeProperty('--cpub-contest-actions-h');
});
</script>

<template>
  <!-- Own class namespace: the e2e suite asserts strict-mode single matches on
       several hero classes, so reusing one here would break tests that have
       nothing to do with this component. The first attempt at a namespace
       (`cpub-cbar`) collided with CpubCriteriaBar, whose root is also
       role="group" — the e2e caught it as a two-element strict-mode violation,
       which is exactly what that assertion is for. Verified free before reuse. -->
  <div v-if="shouldRender" ref="root" class="cpub-contest-actions" role="group" aria-label="Contest actions">
    <div class="cpub-contest-actions-inner">
      <!-- ORGANIZER: never offered an entry into their own contest. -->
      <template v-if="canManage">
        <NuxtLink :to="`/contests/${slug}/edit`" class="cpub-btn cpub-btn-primary cpub-contest-actions-main">
          <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Edit
        </NuxtLink>
      </template>

      <!-- JUDGE, while judging is open. -->
      <template v-else-if="canJudge && status === 'judging'">
        <NuxtLink :to="`/contests/${slug}/judge`" class="cpub-btn cpub-btn-primary cpub-contest-actions-main">
          <i class="fa-solid fa-gavel" aria-hidden="true"></i> Judge entries
        </NuxtLink>
      </template>

      <!-- OVER: the useful action is the outcome, not a dead register button. -->
      <template v-else-if="isOver">
        <NuxtLink v-if="status === 'completed'" :to="`/contests/${slug}/results`" class="cpub-btn cpub-btn-primary cpub-contest-actions-main">
          <i class="fa-solid fa-ranking-star" aria-hidden="true"></i> View results
        </NuxtLink>
      </template>

      <!-- ANONYMOUS -->
      <template v-else-if="!isAuthenticated && canRegister">
        <NuxtLink :to="loginTo" class="cpub-btn cpub-btn-primary cpub-contest-actions-main">
          <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Register
        </NuxtLink>
      </template>

      <!-- FULL REGISTRANT: entering is the next step, but only while open. -->
      <template v-else-if="isFull">
        <button
          v-if="status === 'active'"
          type="button"
          class="cpub-btn cpub-btn-primary cpub-contest-actions-main"
          @click="emit('submit-entry')"
        ><i class="fa-solid fa-upload" aria-hidden="true"></i> Submit entry</button>
        <!-- Not a button: there is nothing to press, it is a state. -->
        <span v-else class="cpub-contest-actions-state">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Registered
        </span>
      </template>

      <!-- AUTHENTICATED, NOT YET A FULL REGISTRANT -->
      <template v-else-if="canRegister">
        <button
          type="button"
          class="cpub-btn cpub-btn-primary cpub-contest-actions-main"
          :disabled="registering"
          @click="emit('register')"
        >
          <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i>
          {{ registering ? 'Registering...' : 'Register' }}
        </button>
        <!-- The low-friction alternative, which before this bar existed was
             buried two and a half screens down AND hidden from anonymous
             visitors entirely. -->
        <span v-if="isFollowing" class="cpub-contest-actions-state">
          <i class="fa-solid fa-bell" aria-hidden="true"></i> Following
        </span>
        <button
          v-else
          type="button"
          class="cpub-btn cpub-contest-actions-second"
          :disabled="registering"
          @click="emit('follow')"
        ><i class="fa-solid fa-bell" aria-hidden="true"></i> Follow</button>
      </template>

      <button
        type="button"
        class="cpub-btn cpub-contest-actions-share"
        aria-label="Copy a link to this contest"
        @click="emit('copy-link')"
      ><i class="fa-solid fa-link" aria-hidden="true"></i></button>
    </div>
  </div>
</template>

<style scoped>
/* Hidden by default: this is a narrow-viewport affordance only. Above 768px the
   contest sidebar is sticky and carries the real registration card. */
.cpub-contest-actions { display: none; }

@media (max-width: 768px) {
  .cpub-contest-actions {
    display: block;
    position: fixed;
    inset: auto 0 auto 0;
    /* Below the mobile menu (99) and the topbar (100), which are hardcoded in
       the layouts, and far below the cookie banner (--z-toast) that shares this
       edge of the screen. */
    z-index: 90;
    /* CookieConsent is also fixed to this edge, at --z-toast (1050), and it is
       shown to precisely the anonymous first-time visitor this bar exists for —
       so it would cover the bar completely. It publishes its height; sit above
       it when it is up. */
    bottom: var(--cpub-consent-height, 0px);
    background: var(--surface);
    border-top: var(--border-width-default) solid var(--border);
    /* Mirrors CookieConsent's offset shadow — the house treatment for a bar
       docked to this edge. */
    box-shadow: 0 -2px 0 var(--border);
  }

  .cpub-contest-actions-inner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* First use of safe-area-inset in the monorepo: without it the bar sits
       under the iOS home indicator. */
    padding: var(--space-2) var(--space-3) calc(var(--space-2) + env(safe-area-inset-bottom)) var(--space-3);
  }

  .cpub-contest-actions-main,
  .cpub-contest-actions-second {
    flex: 1;
    justify-content: center;
    min-width: 0;
  }

  .cpub-contest-actions-share {
    flex: 0 0 auto;
    min-width: 44px;
    justify-content: center;
  }

  .cpub-contest-actions-state {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    color: var(--green-text);
  }
}

@media print {
  .cpub-contest-actions { display: none; }
}
</style>
