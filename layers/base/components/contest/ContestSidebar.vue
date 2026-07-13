<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';

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
  /** Public count of registered participants. */
  registrantCount?: number;
  /** In-flight register/unregister request (disables the toggle). */
  registering?: boolean;
}>();

const emit = defineEmits<{
  (e: 'copy-link'): void;
  (e: 'register'): void;
  (e: 'unregister'): void;
}>();

// Registration is open only while a contest is upcoming or active (mirrors the
// server's REGISTERABLE_STATUSES). Past that, the card is informational only.
const REGISTERABLE = ['upcoming', 'active'];
const canRegister = computed(() => REGISTERABLE.includes(props.contest?.status ?? ''));
const loginLink = computed(() => `/auth/login?redirect=/contests/${props.contest?.slug ?? ''}`);

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

// Phase B1 — the timeline renders the contest's stages (its explicit `stages`, or
// the synthesized classic Submissions → Judging → Results when none are defined).
// done/current/upcoming derive from the position of the current stage.
const timeline = computed<TimelineStep[]>(() => {
  const c = props.contest;
  if (!c || c.status === 'cancelled') return [];
  const stages = normalizeStages(c);
  const curId = currentStageId(c);
  const curIdx = curId ? stages.findIndex((s) => s.id === curId) : -1;
  return stages.map((s, i): TimelineStep => ({
    label: s.name,
    date: fmt(s.endsAt ?? s.startsAt ?? null),
    state: curIdx < 0 ? 'upcoming' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'upcoming',
    icon: STAGE_KIND_ICON[s.kind] ?? 'fa-circle-dot',
  }));
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
        <div class="cpub-sb-row"><strong>Entries:</strong> {{ contest?.entryCount ?? 0 }}</div>
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

    <!-- REGISTRATION -->
    <div v-if="canRegister || (registrantCount ?? 0) > 0" class="cpub-sb-card cpub-sb-register">
      <div class="cpub-sb-title"><i class="fa-solid fa-user-plus"></i> Registration</div>

      <p class="cpub-sb-regcount">
        <strong>{{ registrantCount ?? 0 }}</strong>
        {{ (registrantCount ?? 0) === 1 ? 'participant registered' : 'participants registered' }}
      </p>

      <template v-if="canRegister">
        <!-- Anonymous: send to sign-in, returning to this contest. -->
        <NuxtLink v-if="!isAuthenticated" :to="loginLink" class="cpub-btn cpub-btn-primary cpub-sb-regbtn">
          <i class="fa-solid fa-right-to-bracket"></i> Log in to register
        </NuxtLink>

        <!-- Registered: confirmed state + a toggle to cancel. State is carried by
             text + icon (not colour alone) and aria-pressed for assistive tech. -->
        <template v-else-if="registered">
          <p class="cpub-sb-regstate">
            <i class="fa-solid fa-circle-check"></i> You are registered
          </p>
          <button
            type="button"
            class="cpub-btn cpub-sb-regbtn cpub-sb-regcancel"
            :aria-pressed="true"
            :disabled="registering"
            @click="emit('unregister')"
          >
            <i class="fa-solid fa-xmark"></i>
            {{ registering ? 'Cancelling...' : 'Cancel registration' }}
          </button>
        </template>

        <!-- Not registered: the primary CTA. -->
        <button
          v-else
          type="button"
          class="cpub-btn cpub-btn-primary cpub-sb-regbtn"
          :aria-pressed="false"
          :disabled="registering"
          @click="emit('register')"
        >
          <i class="fa-solid fa-user-plus"></i>
          {{ registering ? 'Registering...' : 'Register for this contest' }}
        </button>

        <p class="cpub-sb-reghint">Get a confirmation and deadline reminders by email.</p>
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
.cpub-tl-date { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); margin-top: 1px; }
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
