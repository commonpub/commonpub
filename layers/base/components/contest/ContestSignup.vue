<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';
import { templateHasRequiredField } from '@commonpub/schema';
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
  /** Public count of `full` participants. */
  registrantCount?: number;
  /** In-flight register/unregister request (disables controls). */
  registering?: boolean;
}>();

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
const loginLink = computed(() => `/auth/login?redirect=/contests/${props.contest?.slug ?? ''}`);
const registerLink = computed(() => `/contests/${props.contest?.slug ?? ''}/register`);

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
  const end = fmtDate(c.endDate);
  const dStart = daysUntil(c.startDate);
  const dEnd = daysUntil(c.endDate);
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

// When the operator's form has any REQUIRED field or must-accept agreement, FULL
// registration MUST go through the form (so the requirement is enforced + consent
// recorded); an all-optional form (incl. the legacy default) keeps the one-click flow.
const templateHasRequired = computed(() => templateHasRequiredField(registrationTemplate.value));

// A "rich" form (sections / address / file / signature / many fields) is too big for
// the sidebar → it opens on the dedicated /register page; a short-but-required form
// opens in a modal; the bare optional default one-click registers with no form.
const isRich = computed(() => isRichRegistrationForm(registrationTemplate.value));

// --- Modal (short forms only) ---
const modalOpen = ref(false);
const modalRef = ref<HTMLElement | null>(null);
useFocusTrap(modalRef, () => modalOpen.value, () => { modalOpen.value = false; });

/** Primary register CTA: one-click when no fields are required; otherwise route to
 *  the page (rich) or open the modal (short). */
function onRegisterCta(): void {
  if (!templateHasRequired.value) { emit('register', { tier: 'full' }); return; }
  if (isRich.value) { navigateTo(registerLink.value); return; }
  modalOpen.value = true;
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
  <div v-if="canRegister || isRegistered || (registrantCount ?? 0) > 0" class="cpub-sb-card cpub-signup">
    <div class="cpub-sb-title"><i class="fa-solid fa-user-plus"></i> Registration</div>

    <!-- Milestone / status line -->
    <p v-if="milestone" class="cpub-su-milestone">
      <span class="cpub-su-ms-label">{{ milestone.label }}</span>
      <span v-if="milestone.date" class="cpub-su-ms-date">{{ milestone.date }}</span>
      <span v-if="milestone.hint" class="cpub-su-ms-hint">{{ milestone.hint }}</span>
    </p>

    <p class="cpub-su-count">
      <strong>{{ registrantCount ?? 0 }}</strong>
      {{ (registrantCount ?? 0) === 1 ? 'maker registered' : 'makers registered' }}
    </p>

    <!-- ANONYMOUS: send to sign-in -->
    <template v-if="!isAuthenticated && canRegister">
      <NuxtLink :to="loginLink" class="cpub-btn cpub-btn-primary cpub-su-btn">
        <i class="fa-solid fa-right-to-bracket"></i> Log in to register
      </NuxtLink>
      <p class="cpub-su-hint">Registering enters you into the contest and gets you deadline reminders. You can also just opt in for reminders.</p>
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
        <i class="fa-solid fa-bell"></i> Just get reminders
      </button>
      <p class="cpub-su-hint">Register to enter + get every update and reminder. Not ready? Get reminders only, no commitment.</p>
    </template>

    <!-- REGISTERED (either tier): confirmation + what's next -->
    <template v-else-if="isRegistered">
      <p class="cpub-su-state" :class="isFull ? 'cpub-su-state-full' : 'cpub-su-state-rem'">
        <i class="fa-solid" :class="isFull ? 'fa-circle-check' : 'fa-bell'"></i>
        <span>{{ isFull ? "You're registered" : "You'll get reminders" }}</span>
      </p>

      <p v-if="whatsNext" class="cpub-su-next">{{ whatsNext }}</p>

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
        <p class="cpub-su-hint">You're only getting reminders. Register to enter the contest.</p>
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
          <h2 id="cpub-su-modal-title" class="cpub-modal-title">Register for {{ contest?.title }}</h2>
          <button class="cpub-modal-close" aria-label="Close" @click="modalOpen = false"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="cpub-modal-desc">This contest asks a few questions to register.</p>
        <ContestRegistrationForm
          :template="registrationTemplate"
          :saved-fields="savedFields"
          :registering="registering"
          id-prefix="cpub-su-reg"
          save-label="Register"
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
