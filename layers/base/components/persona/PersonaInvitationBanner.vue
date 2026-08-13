<script setup lang="ts">
/**
 * `<PersonaInvitationBanner>` — the dismissible offer to fill in a persona.
 * Rendered IN FLOW on `/dashboard` only.
 *
 * Registered as `<PersonaInvitationBanner>` by Nuxt's pathPrefix (the `persona`
 * directory prefix is deduplicated against the `Persona` filename prefix).
 *
 * Modelled on `EmailVerificationBanner.vue`: `role="status"`, 44px targets,
 * print-suppressed, in flow rather than mounted by the global-overlays plugin.
 * That inversion of the house rule is deliberate and is argued in plan 8.4: the
 * overlay plugin exists so a fork cannot accidentally DROP something it must
 * not drop, and an optional invitation is precisely the thing a fork should be
 * free to drop. Being in flow also keeps it out of the last tab stop, which is
 * where a plugin-appended host would put it.
 *
 * IT RENDERS NOTHING UNTIL THE STATUS RESOLVES. `/api/persona/status` is
 * per-viewer data, so it is fetched with `useLazyFetch(..., { server: false })`
 * and there is no placeholder, no skeleton meter and above all no zero. A
 * client-only count seeded to `ref(0)` puts a false number into the first paint
 * and into the HTML a crawler reads; that is the session-253 class this
 * component is written to avoid.
 *
 * THE SERVER OWNS THE DECISION. `ClientAuthUser` carries no profile fields at
 * all, so nothing here can infer eligibility. `PersonaStatusResponse.offer` is
 * the answer, computed once server-side so the "offer twice then stop"
 * threshold is not re-derived per surface. The derivation below is a fallback
 * for a server that predates the field, and it fails CLOSED.
 *
 * DISMISSAL IS PERSISTENT, NOT PER-SESSION, AND IT IS A COUNT.
 * `/api/persona/status` READS `cpub-persona-invite-dismissed` and this component
 * WRITES it, which is why the value is a decimal count and not a boolean: the
 * rule is "offer twice, then never again", so a boolean could not express the
 * middle state. A session cookie (no maxAge) would re-ask someone who has
 * answered nothing every single session, forever, which is a soft nag.
 */
import { computed, ref } from 'vue';
import {
  PERSONA_INVITE_DISMISSED_COOKIE,
  PERSONA_INVITE_MAX_DISMISSALS,
} from '@commonpub/persona';

/**
 * The `GET /api/persona/status` contract. Structurally identical to
 * `PersonaStatusResponse` in `server/api/persona/status.get.ts`, and declared
 * here rather than imported because a client component cannot import a Nitro
 * route. `<script setup>` cannot export types either, and a shared `.ts` file
 * inside a Nuxt components directory is scanned as a component and breaks
 * `typecheck` on its missing default export.
 */
interface PersonaStatus {
  /** The `persona` feature flag, as the SERVER sees it. */
  enabled: boolean;
  /** THE decision: `enabled && !hasAnyAnswer && dismissals < 2`. */
  offer?: boolean;
  hasAnyAnswer: boolean;
  completeness: { filled: number; total: number };
  /** Dismissals the server counted, read from the cookie this component writes. */
  dismissals: number;
}

/**
 * The dismissal cookie name and the ceiling come from `@commonpub/persona`, the
 * one place three surfaces can all reach: this component WRITES the cookie,
 * `GET /api/persona/status` READS it, and `BUILTIN_COOKIES` DISCLOSES it. A
 * hand-copied name that drifts fails silently: the refusal stops being
 * remembered and the banner comes back forever.
 */
const DISMISS_COOKIE = PERSONA_INVITE_DISMISSED_COOKIE;
const MAX_DISMISSALS = PERSONA_INVITE_MAX_DISMISSALS;
/** One year. The unit of "I already said no", not "I already said no today". */
const DISMISS_MAX_AGE = 60 * 60 * 24 * 365;

const { persona } = useFeatures();

// Per-viewer, so never server-rendered: `server: false` keeps the status out of
// the SSR payload and out of any shared cache.
const { data: status } = useLazyFetch<PersonaStatus>('/api/persona/status', {
  server: false,
  default: () => null,
});

const dismissCookie = useCookie<string | null>(DISMISS_COOKIE, {
  path: '/',
  sameSite: 'lax',
  maxAge: DISMISS_MAX_AGE,
});

/**
 * Dismissed during THIS page view. Separate from the cookie because the first
 * dismissal is not terminal: the banner is offered twice in total, so the cookie
 * going from absent to "1" must hide it now without claiming it is finished.
 */
const dismissedNow = ref(false);

/** The higher of what the cookie says and what the server counted. */
const dismissals = computed<number>(() => {
  const parsed = Number.parseInt(dismissCookie.value ?? '', 10);
  const fromCookie = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  return Math.max(fromCookie, status.value?.dismissals ?? 0);
});

const offered = computed<boolean>(() => {
  const s = status.value;
  // Not resolved yet: render NOTHING. Not a skeleton, not a zero.
  if (!s) return false;
  if (s.enabled !== true) return false;
  if (typeof s.offer === 'boolean') return s.offer;
  // Fallback only, for a server that predates `offer`. Same rule, computed the
  // same way, and it fails closed when the fields are missing.
  return s.hasAnyAnswer === false && (s.dismissals ?? MAX_DISMISSALS) < MAX_DISMISSALS;
});

const visible = computed<boolean>(
  () =>
    persona.value === true
    && offered.value
    && !dismissedNow.value
    // Belt and braces on terminality: even if a server forgot to fold the count
    // into `offer`, two refusals are two refusals.
    && dismissals.value < MAX_DISMISSALS,
);

function dismiss(): void {
  // Hide first: the person has already said no, and nothing about writing the
  // cookie should be able to leave the banner sitting there.
  dismissedNow.value = true;
  dismissCookie.value = String(Math.min(dismissals.value + 1, MAX_DISMISSALS));
}
</script>

<template>
  <!-- role=status, not role=alert: an optional invitation must never interrupt a
       screen reader mid-sentence. ARIA 1.2 gives status an implicit polite live
       region, so no explicit aria-live (the house convention). No heading and no
       banner landmark: the layout already renders <header> as the page's banner,
       and an <h2> here would corrupt the dashboard's outline. -->
  <div v-if="visible" class="cpub-persona-invite" role="status">
    <p class="cpub-persona-invite-text">
      <i class="fa-regular fa-id-card" aria-hidden="true"></i>
      <span>
        Tell people what you are into and what you build with. It is optional, it takes a minute, and
        you can change it at any time.
      </span>
    </p>
    <div class="cpub-persona-invite-actions">
      <!-- Equal-weight choices: both are real controls of the same size, and the
           refusal is never a text link beside a filled button. -->
      <NuxtLink to="/settings/persona" class="cpub-btn cpub-btn-sm cpub-btn-primary">Fill in your profile</NuxtLink>
      <button
        type="button"
        class="cpub-btn cpub-btn-sm cpub-persona-invite-dismiss"
        aria-label="Dismiss the profile invitation"
        @click="dismiss"
      ><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </div>
  </div>
</template>
