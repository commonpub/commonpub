<script setup lang="ts">
import type { Serialized, ContestDetail, ContestRegistrationFields } from '@commonpub/server';

type Tier = 'full' | 'reminders';

const props = defineProps<{
  contest: Serialized<ContestDetail> | null;
  /** Whether a user session exists (drives register vs. log-in-to-register). */
  isAuthenticated?: boolean;
  /** Viewer's current tier, or null when not registered. */
  tier?: Tier | null;
  /** Viewer's saved signup info (prefills the optional form). */
  savedFields?: ContestRegistrationFields | null;
  /** Public count of `full` participants. */
  registrantCount?: number;
  /** In-flight register/unregister request (disables controls). */
  registering?: boolean;
}>();

const emit = defineEmits<{
  (e: 'register', payload: { tier: Tier; fields?: ContestRegistrationFields }): void;
  (e: 'unregister'): void;
}>();

// Registration is open only while a contest is upcoming or active (mirrors the
// server's REGISTERABLE_STATUSES). Past that, the card is informational only.
const REGISTERABLE = ['upcoming', 'active'];
const status = computed(() => props.contest?.status ?? '');
const canRegister = computed(() => REGISTERABLE.includes(status.value));
const loginLink = computed(() => `/auth/login?redirect=/contests/${props.contest?.slug ?? ''}`);

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

// --- Optional info form ---
const EXPERIENCE = [
  { v: 'first', label: 'First time' },
  { v: 'some', label: 'Some experience' },
  { v: 'experienced', label: 'Experienced' },
] as const;
const TEAM = [
  { v: 'solo', label: 'Solo' },
  { v: 'have', label: 'Have a team' },
  { v: 'looking', label: 'Looking for teammates' },
] as const;

const building = ref('');
const experience = ref<'first' | 'some' | 'experienced' | ''>('');
const team = ref<'solo' | 'have' | 'looking' | ''>('');
// Show the info form expanded automatically when a fresh full registrant has no
// info yet (the high-intent nudge); collapsed once they've saved something.
const infoOpen = ref(false);

function seedForm(f: ContestRegistrationFields | null | undefined): void {
  building.value = f?.building ?? '';
  experience.value = f?.experience ?? '';
  team.value = f?.team ?? '';
}
watch(() => props.savedFields, (f) => seedForm(f), { immediate: true });

const hasSavedInfo = computed(() => {
  const f = props.savedFields;
  return !!(f && (f.building || f.experience || f.team));
});

// Auto-open the form for a full registrant who hasn't shared anything yet.
watch(isFull, (full) => { if (full && !hasSavedInfo.value) infoOpen.value = true; }, { immediate: true });

const formFields = computed<ContestRegistrationFields>(() => {
  const out: ContestRegistrationFields = {};
  const b = building.value.trim();
  if (b) out.building = b;
  if (experience.value) out.experience = experience.value;
  if (team.value) out.team = team.value;
  return out;
});

// Dirty = the form differs from what's saved (so Save is meaningful).
const infoDirty = computed(() => {
  const f = props.savedFields ?? {};
  return (
    (formFields.value.building ?? '') !== (f.building ?? '') ||
    (formFields.value.experience ?? '') !== (f.experience ?? '') ||
    (formFields.value.team ?? '') !== (f.team ?? '')
  );
});

function registerFull(): void {
  emit('register', { tier: 'full', fields: Object.keys(formFields.value).length ? formFields.value : undefined });
}
function registerReminders(): void {
  emit('register', { tier: 'reminders' });
}
function saveInfo(): void {
  emit('register', { tier: 'full', fields: formFields.value });
}
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
        @click="registerFull"
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
          @click="registerFull"
        >
          <i class="fa-solid fa-flag-checkered"></i>
          {{ registering ? 'Registering…' : 'Register for the contest' }}
        </button>
        <p class="cpub-su-hint">You're only getting reminders. Register to enter the contest.</p>
      </template>

      <!-- Full participant: the optional "tell us about you" form -->
      <!-- Only offer the info form while registration is still open: saveInfo()
           POSTs to register, which 400s once the contest leaves upcoming/active. -->
      <template v-if="isFull && canRegister">
        <button
          type="button"
          class="cpub-su-infotoggle"
          :aria-expanded="infoOpen"
          @click="infoOpen = !infoOpen"
        >
          <i class="fa-solid" :class="infoOpen ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
          {{ hasSavedInfo ? 'Edit your details' : 'Tell the organizers about you' }}
          <span class="cpub-su-optional">optional</span>
        </button>

        <div v-if="infoOpen" class="cpub-su-form">
          <label class="cpub-su-field">
            <span class="cpub-su-flabel">What are you thinking of building?</span>
            <textarea
              v-model="building"
              class="cpub-su-textarea"
              rows="2"
              maxlength="280"
              placeholder="A rough idea is fine, it helps the organizers plan."
            ></textarea>
          </label>

          <fieldset class="cpub-su-field cpub-su-chips">
            <legend class="cpub-su-flabel">Your experience</legend>
            <label v-for="opt in EXPERIENCE" :key="opt.v" class="cpub-su-chip" :class="{ 'cpub-su-chip-on': experience === opt.v }">
              <input v-model="experience" type="radio" name="cpub-su-exp" :value="opt.v" class="cpub-su-radio" />
              {{ opt.label }}
            </label>
          </fieldset>

          <fieldset class="cpub-su-field cpub-su-chips">
            <legend class="cpub-su-flabel">Team status</legend>
            <label v-for="opt in TEAM" :key="opt.v" class="cpub-su-chip" :class="{ 'cpub-su-chip-on': team === opt.v }">
              <input v-model="team" type="radio" name="cpub-su-team" :value="opt.v" class="cpub-su-radio" />
              {{ opt.label }}
            </label>
          </fieldset>

          <button
            type="button"
            class="cpub-btn cpub-btn-primary cpub-su-btn cpub-su-save"
            :disabled="registering || !infoDirty"
            @click="saveInfo"
          >
            <i class="fa-solid fa-floppy-disk"></i>
            {{ registering ? 'Saving…' : 'Save details' }}
          </button>
        </div>
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
</template>

<style scoped>
.cpub-signup { display: block; }
.cpub-su-milestone { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0 0 10px; padding-bottom: 10px; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-su-ms-label { font-size: 12px; font-weight: 700; color: var(--text); }
.cpub-su-ms-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-su-ms-hint { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--accent); border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 1px 6px; }

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
.cpub-su-state-rem { color: var(--accent); }

.cpub-su-next { font-size: 12px; color: var(--text-dim); line-height: 1.6; margin: 0 0 12px; }

/* Optional info form */
.cpub-su-infotoggle { display: flex; align-items: center; gap: 7px; width: 100%; background: none; border: none; padding: 8px 0; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-dim); font-family: inherit; text-align: left; }
.cpub-su-infotoggle:hover { color: var(--text); }
.cpub-su-optional { margin-left: auto; font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); border: var(--border-width-default) solid var(--border2); padding: 1px 5px; }

.cpub-su-form { display: flex; flex-direction: column; gap: 12px; padding: 4px 0 12px; }
.cpub-su-field { border: none; padding: 0; margin: 0; min-width: 0; }
.cpub-su-flabel { display: block; font-size: 11px; font-weight: 600; color: var(--text-dim); margin-bottom: 6px; }
.cpub-su-textarea { width: 100%; box-sizing: border-box; resize: vertical; font-family: inherit; font-size: 12px; line-height: 1.5; padding: 8px; color: var(--text); background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); }
.cpub-su-textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

.cpub-su-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cpub-su-chips .cpub-su-flabel { flex-basis: 100%; }
.cpub-su-chip { display: inline-flex; align-items: center; font-size: 11px; padding: 5px 10px; color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); cursor: pointer; user-select: none; }
.cpub-su-chip:hover { border-color: var(--accent-border); color: var(--text); }
.cpub-su-chip-on { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); font-weight: 600; }
/* Keep the native radio for a11y but hide it visually; focus ring lands on the chip. */
.cpub-su-radio { position: absolute; opacity: 0; width: 1px; height: 1px; }
.cpub-su-chip:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }

.cpub-su-save { margin-top: 2px; }
.cpub-su-leave { color: var(--text-dim); margin-top: 4px; margin-bottom: 0; }
.cpub-su-leave:hover:not(:disabled) { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }
</style>
