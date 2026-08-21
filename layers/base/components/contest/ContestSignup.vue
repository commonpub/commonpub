<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';
import { effectiveRegistrationTemplate, isRichRegistrationForm } from '../../utils/contestRegistration';

type Tier = 'full' | 'reminders';

const props = defineProps<{
  contest: Serialized<ContestDetail> | null;
  /** Whether a user session exists (drives register vs. log-in-to-register). */
  isAuthenticated?: boolean;
  /** Viewer's current tier, or null when not registered. */
  tier?: Tier | null;
  /** Viewer's saved signup answers (prefills the info form). */
  savedFields?: Record<string, string> | null;
  /** In-flight register/unregister request (disables controls). */
  registering?: boolean;
  /** Whether the viewer already has an entry in this contest. Drives the
   *  "registered, but nothing submitted yet" nudge. */
  hasEntry?: boolean;
}>();

// Public registration count, read from the SSR'd contest DTO rather than taken
// as a prop from the page's per-viewer `server: false` fetch. That fetch seeds
// its refs to 0, which is why this card served "0 makers registered" in the
// HTML of every contest page. See utils/contestCounts.ts.
const hasRegistrations = computed(() => showsRegisteredCount(props.contest ?? {}));
const registeredCount = computed(() => props.contest?.followerCount ?? 0);

const emit = defineEmits<{
  (e: 'register', payload: { tier: Tier; fields?: Record<string, string> }): void;
  (e: 'unregister'): void;
}>();

// The registration form: the operator's template when set, else the default
// legacy three fields (so nothing regresses for existing contests).
const registrationTemplate = computed(() => effectiveRegistrationTemplate(props.contest?.registrationTemplate));

// Registration is open only while a contest is upcoming or active (mirrors the
// server's REGISTERABLE_STATUSES). Past that, the card is informational only.
const REGISTERABLE = ['upcoming', 'active'];
const status = computed(() => props.contest?.status ?? '');
const canRegister = computed(() => REGISTERABLE.includes(status.value));
// Log in and land IN the registration form. See ContestHero.vue's loginLink.
const loginLink = computed(() => `/auth/login?redirect=/contests/${props.contest?.slug ?? ''}/register`);
const registerLink = computed(() => `/contests/${props.contest?.slug ?? ''}/register`);

/**
 * Does registering, on its own, enter you?
 *
 * `combined` creates a `contest_entries` row with the registration. `light` (the
 * default, and what every live contest uses) does NOT: registration is a
 * participant record, and the entry is a separate act.
 *
 * This distinction is why the copy below is mode-aware. It used to promise
 * "Registering enters you into the contest" unconditionally, which is false on a
 * `light` contest, and false in the way that costs entries: a maker registers,
 * reads that they are entered, and never submits anything.
 */
const entersOnRegister = computed(() => props.contest?.registrationMode === 'combined');
const entriesLink = computed(() => `/contests/${props.contest?.slug ?? ''}?tab=entries`);

const isFull = computed(() => props.tier === 'full');
const isReminders = computed(() => props.tier === 'reminders');
const isRegistered = computed(() => props.tier === 'full' || props.tier === 'reminders');

// --- Dates + "what's next" (client-only so the viewer's TZ never mismatches SSR) ---
const mounted = ref(false);
onMounted(() => { mounted.value = true; });

function fmtDate(d: string | null | undefined): string | null {
  if (!d || !mounted.value) return null;
  return formatLocalDate(d);
}

/** Whole days from now until an ISO date (null when unknown / not yet mounted). */
function daysUntil(d: string | null | undefined): number | null {
  if (!d || !mounted.value) return null;
  const ms = new Date(d).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

function humanizeDays(n: number): string {
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 14) return `in ${n} days`;
  if (n < 60) return `in ${Math.round(n / 7)} weeks`;
  return `in ${Math.round(n / 30)} months`;
}

// The headline milestone: what happens next + when. Status-aware.
const milestone = computed<{ label: string; date: string | null; hint: string | null } | null>(() => {
  const c = props.contest;
  if (!c) return null;
  const start = fmtDate(c.startDate);
  const dStart = daysUntil(c.startDate);
  // For an active multi-stage contest, "Submissions close" is the CURRENT stage's
  // deadline (the open proposal/build round), not the far-off final endDate — the
  // reason this card read "Dec 18 / in 5 months" instead of the Sep-6 proposal
  // close. currentStageEnd falls back to endDate for classic contests.
  const closeAt = currentStageEnd(c) ?? c.endDate;
  const end = fmtDate(closeAt);
  const dEnd = daysUntil(closeAt);
  switch (status.value) {
    case 'upcoming':
      // Suppress the countdown hint when the start date is already past (status
      // not yet advanced) — otherwise humanizeDays(<0) would read a contradictory
      // "today" next to a visibly past date. The date itself still shows.
      return { label: 'Submissions open', date: start, hint: dStart != null && dStart >= 0 ? humanizeDays(dStart) : null };
    case 'active':
      return { label: 'Submissions close', date: end, hint: dEnd != null && dEnd >= 0 ? humanizeDays(dEnd) : null };
    case 'judging':
      return { label: 'Judging in progress', date: null, hint: 'Results announced soon' };
    case 'completed':
      return { label: 'Winners announced', date: null, hint: null };
    case 'paused':
      return { label: 'Paused', date: null, hint: "We'll email you when it resumes" };
    default:
      return null;
  }
});

// The onboarding paragraph shown to a registered participant (and, lighter, to a
// prospective one) — "here's what to do, when to check in, what to expect."
const whatsNext = computed<string>(() => {
  switch (status.value) {
    case 'upcoming':
      return 'Submissions haven\'t opened yet, so there\'s nothing to submit right now. Use the time to plan your build and, if you want, find teammates. We\'ll email you the moment submissions open and again as the deadline nears.';
    case 'active':
      return 'Submissions are open. Enter your project before the deadline; you can keep editing it until then. We\'ll send you reminders as the deadline approaches.';
    case 'judging':
      return 'Submissions are closed and judging is underway. There\'s nothing more to do right now. We\'ll email you when the results are announced.';
    case 'completed':
      return 'This contest has ended. Thanks for taking part. Check out the results.';
    case 'paused':
      return 'This contest is paused for now. We\'ll email you when it resumes.';
    default:
      return '';
  }
});

const hasSavedInfo = computed(() => Object.keys(props.savedFields ?? {}).length > 0);

// "Rich" = too big for the ~300px sidebar, so it opens on the dedicated page.
// Only `onEditDetails` still needs this directly; the register decision itself
// moved into resolveRegistrationAction.
const isRich = computed(() => isRichRegistrationForm(registrationTemplate.value));

// --- Modal (short forms only) ---
const modalOpen = ref(false);
const modalRef = ref<HTMLElement | null>(null);
useFocusTrap(modalRef, () => modalOpen.value, () => { modalOpen.value = false; });

/** Primary register CTA. The decision is shared with the page and the action bar
 *  (utils/contestRegistration.ts); this card is the one caller that CAN host a
 *  modal, so it is the only one passing allowModal. */
function onRegisterCta(): void {
  const action = resolveRegistrationAction({
    slug: props.contest?.slug ?? '',
    isAuthenticated: props.isAuthenticated === true,
    template: registrationTemplate.value,
    allowModal: true,
  });
  if (action.kind === 'login' || action.kind === 'page') { navigateTo(action.to); return; }
  if (action.kind === 'modal') { modalOpen.value = true; return; }
  emit('register', { tier: 'full' });
}
/** Edit/add optional details (a full participant): page when rich, else modal. */
function onEditDetails(): void {
  if (isRich.value) { navigateTo(registerLink.value); return; }
  modalOpen.value = true;
}
function registerReminders(): void {
  emit('register', { tier: 'reminders' });
}
function onModalSave(fields: Record<string, string>): void {
  const wasFull = isFull.value;
  emit('register', { tier: 'full', fields });
  // Initial register: DON'T close synchronously — the parent's register() is async
  // and a server-only check (bad email, unowned file, invalid option) can 400 after
  // client validation passes. Closing now would discard the typed answers. The isFull
  // watch below closes the modal only once registration actually succeeds; on failure
  // it stays open with the data intact. Editing details (already full) has no state
  // flip to observe, so close optimistically there (a rare 400 loses only a small edit).
  if (wasFull) modalOpen.value = false;
}
// Close the initial-register modal only on a confirmed success (tier → full).
watch(isFull, (full) => { if (full) modalOpen.value = false; });
</script>

<template>
  <div v-if="canRegister || isRegistered || hasRegistrations" class="cpub-sb-card cpub-signup">
    <div class="cpub-sb-title"><i class="fa-solid fa-user-plus"></i> Registration</div>

    <!-- Milestone / status line -->
    <p v-if="milestone" class="cpub-su-milestone">
      <span class="cpub-su-ms-label">{{ milestone.label }}</span>
      <span v-if="milestone.date" class="cpub-su-ms-date">{{ milestone.date }}</span>
      <span v-if="milestone.hint" class="cpub-su-ms-hint">{{ milestone.hint }}</span>
    </p>

    <!-- One count, from the SSR'd contest DTO. This used to read
         `registrantCount`, which is seeded to 0 and only filled by the page's
         per-viewer `server: false` fetch — so every contest page shipped
         "0 makers registered" in its HTML while the hero two screens above it
         said "10 following". Same source as the hero now, so the two agree and
         the number is right in the server-rendered markup. -->
    <p v-if="hasRegistrations" class="cpub-su-count">
      <strong>{{ registeredCount }}</strong> registered
    </p>

    <!-- ANONYMOUS: send to sign-in -->
    <template v-if="!isAuthenticated && canRegister">
      <NuxtLink :to="loginLink" class="cpub-btn cpub-btn-primary cpub-su-btn">
        <i class="fa-solid fa-right-to-bracket"></i> Log in to register
      </NuxtLink>
      <p class="cpub-su-hint">
        <template v-if="entersOnRegister">Registering enters you into the contest and gets you every update.</template>
        <template v-else>Registering signs you up and gets you every update. Submitting your project is a separate step, once you are registered.</template>
        You can also just follow it for deadline reminders.
      </p>
    </template>

    <!-- AUTHENTICATED, NOT REGISTERED: the two-tier choice -->
    <template v-else-if="isAuthenticated && !isRegistered && canRegister">
      <button
        type="button"
        class="cpub-btn cpub-btn-primary cpub-su-btn cpub-su-register"
        :disabled="registering"
        @click="onRegisterCta"
      >
        <i class="fa-solid fa-flag-checkered"></i>
        {{ registering ? 'Registering…' : 'Register for this contest' }}
      </button>

      <button
        type="button"
        class="cpub-btn cpub-su-btn cpub-su-remind"
        :disabled="registering"
        @click="registerReminders"
      >
        <i class="fa-solid fa-bell"></i> Follow this contest
      </button>
      <p class="cpub-su-hint">
        <template v-if="entersOnRegister">Register to enter and get every update.</template>
        <template v-else>Register first, then submit your project from the Entries tab. Registering alone does not enter you.</template>
        Not ready to enter? Follow to get deadline reminders and be counted among those following.
      </p>
    </template>

    <!-- REGISTERED (either tier): confirmation + what's next -->
    <template v-else-if="isRegistered">
      <p class="cpub-su-state" :class="isFull ? 'cpub-su-state-full' : 'cpub-su-state-rem'">
        <i class="fa-solid" :class="isFull ? 'fa-circle-check' : 'fa-bell'"></i>
        <span>{{ isFull ? "You're registered" : "You're following this contest" }}</span>
      </p>

      <p v-if="whatsNext" class="cpub-su-next">{{ whatsNext }}</p>

      <!-- The step people were missing. A `full` registrant on a `light` contest
           is signed up and has submitted NOTHING, and until now the card said
           "You're registered" and stopped there. Name the next action and link
           straight to it. -->
      <div v-if="isFull && !entersOnRegister && !hasEntry && status === 'active'" class="cpub-su-nextstep">
        <p class="cpub-su-nextstep-title"><i class="fa-solid fa-arrow-right"></i> Next: submit your project</p>
        <p class="cpub-su-nextstep-body">You are registered, but you have not entered a project yet. Registering does not enter you on its own.</p>
        <NuxtLink :to="entriesLink" class="cpub-btn cpub-btn-primary cpub-su-btn">
          <i class="fa-solid fa-upload"></i> Submit your project
        </NuxtLink>
      </div>

      <!-- Reminders-only: offer the upgrade to full participation -->
      <template v-if="isReminders && canRegister">
        <button
          type="button"
          class="cpub-btn cpub-btn-primary cpub-su-btn cpub-su-register"
          :disabled="registering"
          @click="onRegisterCta"
        >
          <i class="fa-solid fa-flag-checkered"></i>
          {{ registering ? 'Registering…' : 'Register for the contest' }}
        </button>
        <p class="cpub-su-hint">You're following this contest. Register to enter and compete.</p>
      </template>

      <!-- Full participant: add / edit optional details (opens the page or modal). -->
      <template v-if="isFull && canRegister">
        <button type="button" class="cpub-su-infotoggle" @click="onEditDetails">
          <i class="fa-solid fa-pen-to-square"></i>
          {{ hasSavedInfo ? 'Edit your details' : 'Tell the organizers about you' }}
          <span class="cpub-su-optional">optional</span>
        </button>
      </template>

      <!-- Leave / turn off -->
      <button
        type="button"
        class="cpub-btn cpub-su-btn cpub-su-leave"
        :disabled="registering"
        @click="emit('unregister')"
      >
        <i class="fa-solid" :class="isFull ? 'fa-arrow-right-from-bracket' : 'fa-bell-slash'"></i>
        {{ isFull ? 'Withdraw from contest' : 'Turn off reminders' }}
      </button>
    </template>

    <!-- Registration closed but the card is still informational (past window) -->
    <template v-else-if="!canRegister">
      <p v-if="whatsNext" class="cpub-su-next">{{ whatsNext }}</p>
    </template>
  </div>

  <!-- Short-form modal (rich forms route to /register instead). -->
  <Teleport to="body">
    <div v-if="modalOpen" class="cpub-modal-backdrop" @click.self="modalOpen = false">
      <div ref="modalRef" class="cpub-modal-content cpub-su-modal" role="dialog" aria-modal="true" aria-labelledby="cpub-su-modal-title">
        <div class="cpub-modal-header">
          <h2 id="cpub-su-modal-title" class="cpub-modal-title">{{ isFull ? 'Your details' : 'Register' }} for {{ contest?.title }}</h2>
          <button class="cpub-modal-close" aria-label="Close" @click="modalOpen = false"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="cpub-modal-desc">{{ isFull ? 'Update the details the organizers asked for.' : 'This contest asks a few questions to register.' }}</p>
        <ContestRegistrationForm
          :template="registrationTemplate"
          :saved-fields="savedFields"
          :registering="registering"
          :already-registered="isFull"
          id-prefix="cpub-su-reg"
          :save-label="isFull ? 'Save details' : 'Register'"
          @save="onModalSave"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-signup { display: block; }
.cpub-su-milestone { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0 0 10px; padding-bottom: 10px; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-su-ms-label { font-size: 12px; font-weight: 700; color: var(--text); }
.cpub-su-ms-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-su-ms-hint { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--accent-text); border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 1px 6px; }

.cpub-su-count { font-size: 12px; color: var(--text-dim); margin: 0 0 12px; }
.cpub-su-count strong { color: var(--text); font-family: var(--font-mono); }

.cpub-su-btn { width: 100%; justify-content: center; margin-bottom: 8px; }
.cpub-su-register { font-weight: 700; }
.cpub-su-remind { color: var(--text-dim); }
.cpub-su-remind:hover:not(:disabled) { color: var(--text); border-color: var(--accent-border); }

/* text-dim (not text-faint) so this instructional hint copy clears WCAG AA (~5.5:1). */
.cpub-su-hint { font-size: 11px; color: var(--text-dim); line-height: 1.5; margin: 2px 0 0; }

.cpub-su-state { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; margin: 0 0 8px; }
.cpub-su-state-full { color: var(--green-text); }
.cpub-su-state-rem { color: var(--accent-text); }

.cpub-su-nextstep { border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 10px 12px; margin: 0 0 12px; }
.cpub-su-nextstep-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--accent-text); margin: 0 0 4px; }
.cpub-su-nextstep-body { font-size: 11px; color: var(--text-dim); line-height: 1.5; margin: 0 0 10px; }
.cpub-su-nextstep .cpub-su-btn { margin-bottom: 0; }

.cpub-su-next { font-size: 12px; color: var(--text-dim); line-height: 1.6; margin: 0 0 12px; }

.cpub-su-infotoggle { display: flex; align-items: center; gap: 7px; width: 100%; background: none; border: none; padding: 8px 0; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-dim); font-family: inherit; text-align: left; }
.cpub-su-infotoggle:hover { color: var(--text); }
.cpub-su-optional { margin-left: auto; font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); border: var(--border-width-default) solid var(--border2); padding: 1px 5px; }

.cpub-su-leave { color: var(--text-dim); margin-top: 4px; margin-bottom: 0; }
.cpub-su-leave:hover:not(:disabled) { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }

/* Modal (mirrors the shared modal pattern; scoped per component). */
.cpub-modal-backdrop { position: fixed; inset: 0; background: var(--color-surface-scrim, rgba(0,0,0,0.5)); z-index: var(--z-modal-backdrop); display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
.cpub-modal-content { background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-lg); padding: var(--space-6); }
.cpub-su-modal { max-width: 560px; width: 100%; max-height: 88vh; overflow-y: auto; }
.cpub-modal-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2); }
.cpub-modal-title { font-size: var(--text-md); font-weight: var(--font-weight-bold); }
.cpub-modal-close { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: var(--text-base); padding: var(--space-1); }
.cpub-modal-close:hover { color: var(--text); }
.cpub-modal-desc { font-size: var(--text-sm); color: var(--text-dim); margin-bottom: var(--space-4); }
</style>
