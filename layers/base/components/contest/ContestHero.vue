<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';

const props = defineProps<{
  contest: Serialized<ContestDetail> | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  transitioning: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit-entry'): void;
  (e: 'transition', status: string): void;
  (e: 'copy-link'): void;
}>();

const c = computed(() => props.contest);

// Non-destructive banner framing (P4). null/absent ⇒ the legacy cover fit, so
// existing contests look identical until an organiser adjusts framing.
const bannerStyle = computed(() => imageFramingStyle(c.value?.bannerMeta ?? null));

// Local wall-clock formatting (dates) and the live countdown are timezone- and
// clock-dependent, so they would mismatch between the server's TZ and the viewer's
// on hydration (and Vue won't rectify it in prod). Gate them on a client `mounted`
// flag: SSR + the first hydration tick render nothing, then the viewer-local value
// fills in on mount.
const mounted = ref(false);

// Countdown timer
const countdown = ref({ days: '00', hours: '00', mins: '00', secs: '00' });
const targetPassed = ref(false);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function pad(n: number): string { return String(n).padStart(2, '0'); }

// The countdown target depends on the lifecycle stage: an UPCOMING contest counts
// down to when it OPENS (startDate); while JUDGING, to the judging deadline;
// otherwise (active) to the submission close (endDate).
const countdownTargetStr = computed<string | null>(() => {
  const s = c.value?.status;
  if (s === 'judging') return c.value?.judgingEndDate ?? c.value?.endDate ?? null;
  if (s === 'upcoming') return c.value?.startDate ?? null;
  return c.value?.endDate ?? null;
});

function updateCountdown(): void {
  const targetStr = countdownTargetStr.value;
  const target = targetStr ? new Date(targetStr) : new Date();
  const now = new Date();
  const rawDiff = Math.floor((target.getTime() - now.getTime()) / 1000);
  targetPassed.value = rawDiff <= 0;
  let diff = Math.max(0, rawDiff);
  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  countdown.value = { days: pad(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}

onMounted(() => {
  mounted.value = true;
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});

// Compact "5d 12h" style remaining-time string for the inline countdown chip.
const compactCountdown = computed<string>(() => {
  const d = Number(countdown.value.days);
  const h = Number(countdown.value.hours);
  const m = Number(countdown.value.mins);
  const s = Number(countdown.value.secs);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
});

const countdownLabel = computed(() => {
  const s = c.value?.status;
  if (s === 'completed' || s === 'cancelled') return 'Contest ended';
  if (s === 'judging') return 'Judging ends in';
  if (s === 'upcoming') return 'Opens in';
  return 'Submissions close in';
});

const isEnded = computed(() => c.value?.status === 'completed' || c.value?.status === 'cancelled');
const isPaused = computed(() => c.value?.status === 'paused');
const isDraft = computed(() => c.value?.status === 'draft');
// Live countdown only while the clock is actually running (client) AND its target
// is still in the future. Before mount the target hasn't been evaluated, so show
// nothing live yet (the static fallbacks below cover ended/paused/draft).
const showCountdown = computed(() => mounted.value && !isEnded.value && !isPaused.value && !isDraft.value && !!countdownTargetStr.value && !targetPassed.value);

function fmtDate(s: string | null | undefined): string {
  return mounted.value ? formatLocalDate(s) : '';
}
// Static date shown when the relevant target is in the past but the contest hasn't
// been advanced yet (e.g. an upcoming contest whose open date arrived).
const dateNote = computed<string | null>(() => {
  if (!mounted.value || isEnded.value || isPaused.value || isDraft.value || !targetPassed.value) return null;
  if (c.value?.status === 'upcoming') return c.value?.startDate ? `Opens ${fmtDate(c.value.startDate)}` : null;
  return c.value?.endDate ? `Closed ${fmtDate(c.value.endDate)}` : null;
});

// Bidirectional lifecycle controls — the valid-transition map + button metadata
// live in utils/contestTransitions.ts (shared with the contest edit page).
const availableTransitions = computed<string[]>(() => contestTransitionsFrom(c.value?.status));
const statusAction = contestStatusAction;

// The hero shows the short `subheading` (a dedicated tagline field). For older
// contests without one, fall back to a clean, plain-text, CSS-clamped excerpt of
// the (possibly long Markdown) description — so the hero never dumps a raw
// `## ...` wall. The full formatted description renders in the About tab.
const tagline = computed<string>(() => {
  const sub = (c.value?.subheading ?? '').trim();
  if (sub) return sub;
  return markdownToExcerpt(c.value?.description) || '';
});

// When a contest defines explicit stages, surface the current stage's name beside
// the status pill (default-flow contests show nothing extra).
const currentStageName = computed<string | null>(() => {
  const cv = c.value;
  if (!cv || !cv.stages || cv.stages.length === 0) return null;
  const cid = currentStageId(cv);
  return cv.stages.find((s) => s.id === cid)?.name ?? null;
});

const dateRange = computed<string>(() => {
  if (!mounted.value) return '';
  const start = c.value?.startDate ? formatLocalDate(c.value.startDate, { year: false }) : '';
  const end = c.value?.endDate ? formatLocalDate(c.value.endDate) : '';
  if (start && end) return `${start} to ${end}`;
  return start || end;
});

const entryCount = computed<number>(() => c.value?.entryCount ?? 0);
</script>

<template>
  <div class="cpub-hero">
    <!-- Slim banner band (constrained) — the hero image, not a tall block. -->
    <div v-if="c?.bannerUrl" class="cpub-hero-banner">
      <img :src="c.bannerUrl" :alt="`${c?.title || 'Contest'} banner`" :style="bannerStyle" />
    </div>

    <!-- Compact bar — title + status + meta + actions in one tight, clean band
         (replaces the old tall, dark, patterned hero). -->
    <div class="cpub-hero-bar">
      <div class="cpub-hero-bar-inner">
        <div v-if="c?.status === 'cancelled'" class="cpub-cancelled-banner">
          <i class="fa-solid fa-ban"></i> This contest has been cancelled.
        </div>

        <div class="cpub-hero-top">
          <span class="cpub-contest-badge"><i class="fa fa-trophy"></i> Contest</span>
          <span class="cpub-status-pill" :data-status="c?.status || 'upcoming'">{{ c?.status || 'upcoming' }}</span>
          <span v-if="currentStageName" class="cpub-stage-chip"><i class="fa-solid fa-diagram-project"></i> {{ currentStageName }}</span>

          <span v-if="showCountdown" class="cpub-countdown-chip">
            <i class="fa fa-clock"></i> {{ countdownLabel }} <strong>{{ compactCountdown }}</strong>
          </span>
          <span v-else-if="isPaused" class="cpub-countdown-chip cpub-countdown-chip-muted"><i class="fa-solid fa-circle-pause"></i> Submissions paused</span>
          <span v-else-if="isDraft" class="cpub-countdown-chip cpub-countdown-chip-muted"><i class="fa-solid fa-pen-ruler"></i> Draft, not launched</span>
          <span v-else-if="dateNote" class="cpub-countdown-chip cpub-countdown-chip-muted"><i class="fa-regular fa-calendar"></i> {{ dateNote }}</span>
          <span v-else-if="isEnded" class="cpub-countdown-chip cpub-countdown-chip-muted"><i class="fa-solid fa-flag-checkered"></i> {{ countdownLabel }}</span>
        </div>

        <h1 class="cpub-hero-title">{{ c?.title || 'Contest' }}</h1>
        <p v-if="tagline" class="cpub-hero-tagline">{{ tagline }}</p>

        <div class="cpub-hero-foot">
          <div class="cpub-hero-meta">
            <span v-if="dateRange" class="cpub-hero-meta-item"><i class="fa fa-calendar"></i> {{ dateRange }}</span>
            <span class="cpub-hero-meta-item"><i class="fa fa-folder-open"></i> {{ entryCount }} {{ entryCount === 1 ? 'entry' : 'entries' }}</span>
          </div>
          <div class="cpub-hero-cta">
            <button v-if="isAuthenticated && c?.status === 'active'" class="cpub-btn cpub-btn-primary" @click="emit('submit-entry')"><i class="fa fa-upload"></i> Submit Entry</button>
            <button class="cpub-btn" @click="emit('copy-link')"><i class="fa fa-link"></i> Share</button>
          </div>
        </div>

        <!-- Admin controls — bidirectional, derived from the valid-transition map. -->
        <div v-if="isAdmin && c" class="cpub-admin-controls">
          <span class="cpub-admin-controls-label"><i class="fa-solid fa-shield-halved"></i> Stage</span>
          <button
            v-for="t in availableTransitions"
            :key="t"
            class="cpub-btn cpub-btn-sm"
            :class="{ 'cpub-btn-cancel': t === 'cancelled' }"
            :disabled="transitioning"
            @click="emit('transition', t)"
          ><i class="fa-solid" :class="statusAction(t).icon"></i> {{ statusAction(t).label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── SLIM BANNER ── constrained hero image (was a tall ≤360px band). */
.cpub-hero-banner {
  width: 100%;
  aspect-ratio: 4 / 1;
  max-height: 220px;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  overflow: hidden;
}
.cpub-hero-banner img { display: block; width: 100%; height: 100%; object-fit: cover; }

/* ── COMPACT BAR ── one tight, clean band on a surface background. */
.cpub-hero-bar { background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); }
.cpub-hero-bar-inner { max-width: 1100px; margin: 0 auto; padding: 20px 32px; }

.cpub-cancelled-banner { background: var(--red-bg); border: var(--border-width-default) solid var(--red-border); color: var(--red); padding: 10px 14px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }

.cpub-hero-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.cpub-contest-badge { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent); padding: 3px 10px; border-radius: var(--radius); display: inline-flex; align-items: center; gap: 5px; }
.cpub-contest-badge i { font-size: 8px; }
.cpub-status-pill { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-family: var(--font-mono); padding: 3px 10px; border-radius: var(--radius); border: var(--border-width-default) solid var(--border2); color: var(--text-dim); }
.cpub-status-pill[data-status="active"] { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-pill[data-status="judging"] { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-pill[data-status="upcoming"] { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-pill[data-status="paused"] { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-pill[data-status="draft"] { color: var(--text-faint); border-color: var(--border2); border-style: dashed; }
.cpub-status-pill[data-status="completed"], .cpub-status-pill[data-status="cancelled"] { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.cpub-stage-chip { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-family: var(--font-mono); padding: 3px 10px; border-radius: var(--radius); border: var(--border-width-default) solid var(--accent-border); color: var(--accent); background: var(--accent-bg); display: inline-flex; align-items: center; gap: 5px; }
.cpub-stage-chip i { font-size: 8px; }

/* Inline countdown chip (pushed to the right of the top row). */
.cpub-countdown-chip { margin-left: auto; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.cpub-countdown-chip i { color: var(--accent); }
.cpub-countdown-chip strong { color: var(--accent); font-weight: 700; }
.cpub-countdown-chip-muted i { color: var(--text-faint); }

.cpub-hero-title { font-size: 26px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; margin: 0 0 6px; color: var(--text); }
.cpub-hero-tagline { font-size: 13px; color: var(--text-dim); line-height: 1.55; max-width: 680px; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.cpub-hero-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.cpub-hero-meta { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-hero-meta-item { display: flex; align-items: center; gap: 6px; }
.cpub-hero-cta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cpub-btn-cancel { color: var(--red); border-color: var(--red-border); }
.cpub-btn-cancel:hover { background: var(--red-bg); }

.cpub-admin-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding: 10px 14px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-admin-controls-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-right: 4px; font-family: var(--font-mono); }

@media (max-width: 768px) {
  .cpub-hero-banner { max-height: 160px; }
  .cpub-hero-bar-inner { padding: 16px; }
  .cpub-hero-title { font-size: 21px; }
  .cpub-hero-meta { gap: 12px; }
  .cpub-countdown-chip { margin-left: 0; }
}
@media (max-width: 480px) {
  .cpub-hero-title { font-size: 19px; }
  .cpub-hero-foot { align-items: stretch; }
  .cpub-hero-cta { width: 100%; }
  .cpub-hero-cta .cpub-btn { flex: 1; justify-content: center; }
}
</style>
