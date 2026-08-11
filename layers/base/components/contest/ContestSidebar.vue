<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';

type Tier = 'full' | 'reminders';

const props = defineProps<{
  contest: Serialized<ContestDetail> | null;
  isOwner?: boolean;
  /** Viewer can edit this contest (owner / editor / contest.manage). Shows Edit. */
  canManage?: boolean;
  /** True when the viewer is an accepted, non-guest judge able to score. */
  canJudge?: boolean;
  /** Whether a user session exists (drives register vs. log-in-to-register). */
  isAuthenticated?: boolean;
  /** Whether the current viewer is registered for this contest. */
  registered?: boolean;
  /** Viewer's registration tier (`full` / `reminders` / null) — drives the rich signup card. */
  tier?: Tier | null;
  /** Viewer's saved signup info (prefills the optional form). */
  savedFields?: Record<string, string> | null;
  /** In-flight register/unregister request (disables the toggle). */
  registering?: boolean;
}>();

// Public registration count, from the SSR'd contest DTO. The `registrantCount`
// and `followerCount` props this card used to take came from the page's
// per-viewer `server: false` fetch and were 0 in every server-rendered page.
const hasRegistrations = computed(() => showsRegisteredCount(props.contest ?? {}));
const registeredCount = computed(() => props.contest?.followerCount ?? 0);

const emit = defineEmits<{
  (e: 'copy-link'): void;
  // Payload REQUIRED. It used to be optional, and this card's fallback emitted
  // with none — the page then defaulted to `tier: 'full'`, so a button labelled
  // "Follow this contest" created a FULL registration, bypassing the required
  // fields and recorded agreements that contestEntryRequiresRegistration exists
  // to enforce, and then reported "You're following this contest".
  (e: 'register', payload: { tier: Tier; fields?: Record<string, string> }): void;
  (e: 'unregister'): void;
}>();

// The two-tier signup card is the default registration experience; when the flag
// is off, fall back to the simple single reminders opt-in below.
const { contestSignup } = useFeatures();

// Registration is open only while a contest is upcoming or active (mirrors the
// server's REGISTERABLE_STATUSES). Past that, the card is informational only.
const REGISTERABLE = ['upcoming', 'active'];
const canRegister = computed(() => REGISTERABLE.includes(props.contest?.status ?? ''));
// Log in and land IN the registration form. See ContestHero.vue's loginLink.
const loginLink = computed(() => `/auth/login?redirect=/contests/${props.contest?.slug ?? ''}/register`);

type StepState = 'done' | 'current' | 'upcoming';
interface TimelineStep { label: string; date: string | null; state: StepState; icon: string }

// toLocaleDateString is timezone-dependent, so it would mismatch between the
// server's TZ and the viewer's on hydration. Gate it on a client `mounted` flag so
// the timeline dates only render (in the viewer's local TZ) after mount.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });

function fmt(d: string | null | undefined): string | null {
  if (!d || !mounted.value) return null;
  return formatLocalDate(d);
}

// A stage's schedule line: both bounds as a range ("Aug 15 to Sep 15, 2026"), or a
// single labeled date when a stage carries only one (a synthesized Judging/Results
// stage often has just an end) so "Sep 15" is never ambiguously start-or-end.
function stageDates(startsAt?: string | null, endsAt?: string | null): string | null {
  if (!mounted.value) return null;
  const hasStart = !!startsAt;
  const hasEnd = !!endsAt;
  if (hasStart && hasEnd) return formatLocalDateRange(startsAt, endsAt);
  if (hasEnd) return `Ends ${formatLocalDate(endsAt)}`;
  if (hasStart) return `Starts ${formatLocalDate(startsAt)}`;
  return null;
}

// Phase B1 — the timeline renders the contest's stages (its explicit `stages`, or
// the synthesized classic Submissions → Judging → Results when none are defined).
// done/current/upcoming derive from the position of the current stage.
const timeline = computed<TimelineStep[]>(() => {
  const c = props.contest;
  if (!c || c.status === 'cancelled') return [];
  const stages = normalizeStages(c);
  const curId = currentStageId(c);
  const curIdx = curId ? stages.findIndex((s) => s.id === curId) : -1;
  return stages.map((s, i): TimelineStep => {
    // A stage's END is its own deadline; its START is its explicit `startsAt`, else
    // the previous stage's end (a contest timeline is contiguous — one stage begins
    // where the last ended), else the contest start for the first stage. This surfaces
    // a start→end span for every stage even when only per-stage deadlines are stored.
    const end = s.endsAt ?? null;
    const derivedStart = s.startsAt ?? (i > 0 ? stages[i - 1].endsAt : c.startDate) ?? null;
    // A DERIVED (non-explicit) start that lands after this stage's end would render a
    // backwards "later to earlier" span (out-of-order stages / judgingEndDate < endDate);
    // drop it so the stage shows a single "Ends X" instead. Explicit startsAt is honored.
    const start = (!s.startsAt && derivedStart && end && new Date(derivedStart).getTime() > new Date(end).getTime())
      ? null
      : derivedStart;
    return {
      label: s.name,
      date: stageDates(start, end),
      state: curIdx < 0 ? 'upcoming' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'upcoming',
      icon: STAGE_KIND_ICON[s.kind] ?? 'fa-circle-dot',
    };
  });
});

function statusClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'cpub-status-draft',
    upcoming: 'cpub-status-upcoming',
    active: 'cpub-status-active',
    paused: 'cpub-status-paused',
    judging: 'cpub-status-judging',
    completed: 'cpub-status-completed',
    cancelled: 'cpub-status-cancelled',
  };
  return map[status] ?? '';
}
</script>

<template>
  <div class="cpub-sidebar">
    <!-- STATUS + TIMELINE -->
    <div class="cpub-sb-card">
      <div class="cpub-sb-title"><i class="fa-solid fa-circle-info"></i> Status</div>
      <div class="cpub-sb-body">
        <div class="cpub-sb-row">
          <strong>Status:</strong>
          <span class="cpub-sb-status" :class="statusClass(contest?.status ?? '')">{{ contest?.status ?? 'unknown' }}</span>
        </div>
        <!-- The counts used to be repeated here, so one contest page showed the
             same people three times under three labels (hero "10 following",
             this card "Following: 10", the signup card "0 makers registered").
             The hero owns the public counts now; this card is status + timeline. -->
      </div>

      <ol v-if="timeline.length" class="cpub-timeline">
        <li
          v-for="step in timeline"
          :key="step.label"
          class="cpub-tl-step"
          :class="`cpub-tl-${step.state}`"
        >
          <span class="cpub-tl-dot"><i class="fa-solid" :class="step.icon"></i></span>
          <div class="cpub-tl-content">
            <div class="cpub-tl-label">{{ step.label }}<span v-if="step.state === 'current'" class="cpub-tl-now">Now</span></div>
            <div v-if="step.date" class="cpub-tl-date">{{ step.date }}</div>
          </div>
        </li>
      </ol>
      <p v-else-if="contest?.status === 'cancelled'" class="cpub-sb-cancelled">This contest was cancelled.</p>
    </div>

    <!-- REGISTRATION — the two-tier signup card (default), or the simple opt-in fallback -->
    <ContestSignup
      v-if="contestSignup"
      :contest="contest"
      :is-authenticated="isAuthenticated"
      :tier="tier"
      :saved-fields="savedFields"
      :registering="registering"
      @register="(payload) => emit('register', payload)"
      @unregister="emit('unregister')"
    />
    <div v-else-if="canRegister || hasRegistrations" class="cpub-sb-card cpub-sb-register">
      <div class="cpub-sb-title"><i class="fa-solid fa-user-plus"></i> Registration</div>

      <!-- Same DTO-backed count as the hero and the signup card. Was the
           client-only `registrantCount`, which rendered 0 during SSR. -->
      <p v-if="hasRegistrations" class="cpub-sb-regcount">
        <strong>{{ registeredCount }}</strong> registered
      </p>

      <template v-if="canRegister">
        <!-- Anonymous: send to sign-in, returning to this contest. -->
        <NuxtLink v-if="!isAuthenticated" :to="loginLink" class="cpub-btn cpub-btn-primary cpub-sb-regbtn">
          <i class="fa-solid fa-right-to-bracket"></i> Log in to register
        </NuxtLink>

        <!-- Registered (explicitly, or automatically by submitting an entry):
             confirmed state + a toggle to opt out of reminders. State is carried
             by text + icon (not colour alone) and aria-pressed for assistive tech. -->
        <template v-else-if="registered">
          <p class="cpub-sb-regstate">
            <i class="fa-solid fa-circle-check"></i> You're following this contest
          </p>
          <button
            type="button"
            class="cpub-btn cpub-sb-regbtn cpub-sb-regcancel"
            :aria-pressed="true"
            :disabled="registering"
            @click="emit('unregister')"
          >
            <i class="fa-solid fa-bell-slash"></i>
            {{ registering ? 'Saving...' : 'Unfollow' }}
          </button>
        </template>

        <!-- Not registered: an OPTIONAL low-commitment opt-in. Submitting an entry
             registers you automatically, so this is only for people who want the
             deadline nudges before (or without) entering. -->
        <button
          v-else
          type="button"
          class="cpub-btn cpub-btn-primary cpub-sb-regbtn"
          :aria-pressed="false"
          :disabled="registering"
          @click="emit('register', { tier: 'reminders' })"
        >
          <i class="fa-solid fa-bell"></i>
          {{ registering ? 'Saving...' : 'Follow this contest' }}
        </button>

        <p class="cpub-sb-reghint">Submitting an entry registers you automatically. Follow to get deadline reminders — and be counted among those following — even before you enter.</p>
      </template>
    </div>

    <!-- LINKS -->
    <div class="cpub-sb-card">
      <div class="cpub-sb-title"><i class="fa-solid fa-share-nodes"></i> Share</div>
      <div class="cpub-sb-actions">
        <button class="cpub-btn cpub-btn-sm cpub-sb-btn" @click="emit('copy-link')"><i class="fa fa-link"></i> Copy Link</button>
      </div>
    </div>

    <NuxtLink v-if="canManage || isOwner" :to="`/contests/${contest?.slug}/edit`" class="cpub-btn cpub-sb-link">
      <i class="fa-solid fa-pen-to-square"></i> Edit Contest
    </NuxtLink>

    <NuxtLink v-if="canJudge && (contest?.status === 'judging')" :to="`/contests/${contest?.slug}/judge`" class="cpub-btn cpub-sb-link cpub-sb-judge">
      <i class="fa-solid fa-gavel"></i> Judge Entries
    </NuxtLink>

    <NuxtLink v-if="contest?.status === 'completed'" :to="`/contests/${contest.slug}/results`" class="cpub-btn cpub-sb-link">
      <i class="fa-solid fa-ranking-star"></i> View Results
    </NuxtLink>

    <NuxtLink to="/contests" class="cpub-btn cpub-sb-link"><i class="fa fa-arrow-left"></i> All Contests</NuxtLink>
  </div>
</template>

<style scoped>
.cpub-sb-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; box-shadow: var(--shadow-md); }
.cpub-sb-title { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
.cpub-sb-body { font-size: 12px; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px; }
.cpub-sb-row { display: flex; align-items: center; gap: 6px; }
.cpub-sb-status { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-default) solid; }
.cpub-status-draft { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); border-style: dashed; }
.cpub-status-upcoming { color: var(--yellow-text); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green-text); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-paused { color: var(--yellow-text); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }
.cpub-status-cancelled { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }

/* TIMELINE */
.cpub-timeline { list-style: none; margin: 14px 0 0; padding: 0; }
.cpub-tl-step { display: flex; gap: 10px; position: relative; padding-bottom: 14px; }
.cpub-tl-step:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 22px; bottom: 0; width: var(--border-width-default); background: var(--border2); }
.cpub-tl-dot { width: 23px; height: 23px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: var(--border-width-default) solid var(--border2); background: var(--surface); color: var(--text-faint); font-size: 9px; border-radius: 50%; z-index: 1; }
.cpub-tl-content { padding-top: 2px; }
.cpub-tl-label { font-size: 12px; font-weight: 600; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
.cpub-tl-date { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); margin-top: 1px; line-height: 1.45; }
.cpub-tl-now { font-size: 8px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .08em; color: var(--accent); border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 1px 5px; }

.cpub-tl-done .cpub-tl-dot { color: var(--green-text); border-color: var(--green-border); background: var(--green-bg); }
.cpub-tl-done .cpub-tl-label { color: var(--text); }
.cpub-tl-current .cpub-tl-dot { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.cpub-tl-current .cpub-tl-label { color: var(--text); font-weight: 700; }

.cpub-sb-cancelled { font-size: 11px; color: var(--red-text); margin: 10px 0 0; }

.cpub-sb-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.cpub-sb-btn { flex: 1; justify-content: center; }

/* REGISTRATION */
.cpub-sb-regcount { font-size: 12px; color: var(--text-dim); margin: 0 0 12px; }
.cpub-sb-regcount strong { color: var(--text); font-family: var(--font-mono); }
.cpub-sb-regbtn { width: 100%; justify-content: center; }
.cpub-sb-regstate { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--green-text); margin: 0 0 8px; }
.cpub-sb-regcancel { color: var(--text-dim); }
.cpub-sb-regcancel:hover:not(:disabled) { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }
.cpub-sb-reghint { font-size: 11px; color: var(--text-faint); line-height: 1.5; margin: 10px 0 0; }
.cpub-sb-link { width: 100%; text-align: center; display: block; margin-top: 12px; }
.cpub-sb-judge { color: var(--accent); border-color: var(--accent-border); }
</style>
