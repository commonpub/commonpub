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
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
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
// Live countdown only while the clock is actually running AND its target is still
// in the future. Once the target passes (an upcoming contest whose open date has
// arrived, or an active one past its close), fall back to a static date note.
const showCountdown = computed(() => !isEnded.value && !isPaused.value && !isDraft.value && !!countdownTargetStr.value && !targetPassed.value);

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// Static date shown when the relevant target is in the past but the contest hasn't
// been advanced yet (e.g. an upcoming contest whose open date arrived).
const dateNote = computed<string | null>(() => {
  if (isEnded.value || isPaused.value || isDraft.value || !targetPassed.value) return null;
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

// Phase B1 — when a contest defines explicit stages, surface the current stage's
// name beside the status pill (default-flow contests show nothing extra).
const currentStageName = computed<string | null>(() => {
  const cv = c.value;
  if (!cv || !cv.stages || cv.stages.length === 0) return null;
  const cid = currentStageId(cv);
  return cv.stages.find((s) => s.id === cid)?.name ?? null;
});

const dateRange = computed<string>(() => {
  const fmt = (d: string, withYear = false) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  const start = c.value?.startDate ? fmt(c.value.startDate) : '';
  const end = c.value?.endDate ? fmt(c.value.endDate, true) : '';
  if (start && end) return `${start}, ${end}`;
  return start || end;
});
</script>

<template>
  <div class="cpub-hero">
    <!-- Banner band — full-width image at the top, the same way other content
         pages render their hero banner (clean band, never overlaid by text). -->
    <div v-if="c?.bannerUrl" class="cpub-hero-banner">
      <img :src="c.bannerUrl" :alt="`${c?.title || 'Contest'} banner`" />
    </div>

    <!-- Hero body — the contest's dark, patterned section. Two columns:
         title + details on the left, the countdown on the right. -->
    <div class="cpub-hero-body">
      <div class="cpub-hero-pattern" aria-hidden="true">
        <div class="cpub-hero-dots"></div>
        <div class="cpub-hero-lines"></div>
      </div>

      <div class="cpub-hero-inner">
        <div v-if="c?.status === 'cancelled'" class="cpub-cancelled-banner">
          <i class="fa-solid fa-ban"></i> This contest has been cancelled.
        </div>

        <div class="cpub-hero-grid">
          <!-- LEFT: title + details + actions -->
          <div class="cpub-hero-main">
            <div class="cpub-hero-eyebrow">
              <span class="cpub-contest-badge"><i class="fa fa-trophy"></i> Contest</span>
              <span class="cpub-status-pill" :data-status="c?.status || 'upcoming'">{{ c?.status || 'upcoming' }}</span>
              <span v-if="currentStageName" class="cpub-stage-chip"><i class="fa-solid fa-diagram-project"></i> {{ currentStageName }}</span>
            </div>

            <h1 class="cpub-hero-title">{{ c?.title || 'Contest' }}</h1>
            <p v-if="tagline" class="cpub-hero-tagline">{{ tagline }}</p>

            <div class="cpub-hero-meta">
              <span v-if="dateRange" class="cpub-hero-meta-item"><i class="fa fa-calendar"></i> {{ dateRange }}</span>
              <span class="cpub-hero-meta-item"><i class="fa fa-folder-open"></i> {{ c?.entryCount ?? 0 }} {{ (c?.entryCount ?? 0) === 1 ? 'entry' : 'entries' }}</span>
            </div>

            <div class="cpub-hero-cta">
              <button v-if="isAuthenticated && c?.status === 'active'" class="cpub-btn cpub-btn-primary cpub-btn-lg" @click="emit('submit-entry')"><i class="fa fa-upload"></i> Submit Entry</button>
              <button class="cpub-btn cpub-btn-lg cpub-btn-dark" @click="emit('copy-link')"><i class="fa fa-link"></i> Share</button>
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

          <!-- RIGHT: countdown -->
          <aside class="cpub-hero-side">
            <div v-if="showCountdown" class="cpub-countdown-section">
              <div class="cpub-countdown-label"><i class="fa fa-clock"></i> {{ countdownLabel }}</div>
              <div class="cpub-countdown-row">
                <div class="cpub-countdown-block">
                  <div class="cpub-countdown-val">{{ countdown.days }}</div>
                  <div class="cpub-countdown-unit">Days</div>
                </div>
                <div class="cpub-countdown-sep">:</div>
                <div class="cpub-countdown-block">
                  <div class="cpub-countdown-val">{{ countdown.hours }}</div>
                  <div class="cpub-countdown-unit">Hours</div>
                </div>
                <div class="cpub-countdown-sep">:</div>
                <div class="cpub-countdown-block">
                  <div class="cpub-countdown-val">{{ countdown.mins }}</div>
                  <div class="cpub-countdown-unit">Minutes</div>
                </div>
                <div class="cpub-countdown-sep">:</div>
                <div class="cpub-countdown-block">
                  <div class="cpub-countdown-val">{{ countdown.secs }}</div>
                  <div class="cpub-countdown-unit">Seconds</div>
                </div>
              </div>
            </div>
            <div v-else-if="isPaused" class="cpub-countdown-ended">
              <i class="fa-solid fa-circle-pause"></i>
              <span>Submissions paused</span>
            </div>
            <div v-else-if="isDraft" class="cpub-countdown-ended">
              <i class="fa-solid fa-pen-ruler"></i>
              <span>Draft, not launched</span>
            </div>
            <div v-else-if="dateNote" class="cpub-countdown-ended">
              <i class="fa-regular fa-calendar"></i>
              <span>{{ dateNote }}</span>
            </div>
            <div v-else class="cpub-countdown-ended">
              <i class="fa-solid fa-flag-checkered"></i>
              <span>{{ countdownLabel }}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-hero {
  --hero-bg: var(--text);
  --hero-text: var(--color-text-inverse);
  --hero-text-dim: var(--text-faint);
  /* Alpha of the hero foreground so the structure lines/surfaces track the
     inverted hero in both themes (white-on-dark in light mode, dark-on-light
     in dark mode) instead of vanishing white-on-white. */
  --hero-border: color-mix(in srgb, var(--hero-text) 18%, transparent);
  --hero-surface: color-mix(in srgb, var(--hero-text) 7%, transparent);
}

/* ── BANNER BAND ── full-width, clean, like other content pages' hero banner. */
.cpub-hero-banner {
  width: 100%;
  /* Match the 4:1 upload crop so the banner shows exactly as framed (WYSIWYG)
     instead of being re-cropped by a fixed height. */
  aspect-ratio: 4 / 1;
  max-height: 360px;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  overflow: hidden;
}
.cpub-hero-banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── HERO BODY ── the contest's dark, patterned section. */
.cpub-hero-body {
  position: relative;
  overflow: hidden;
  background: var(--hero-bg);
  padding: 44px 0;
}
.cpub-hero-pattern { position: absolute; inset: 0; }
.cpub-hero-dots { position: absolute; inset: 0; background-image: radial-gradient(var(--accent-border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: .3; }
.cpub-hero-lines { position: absolute; inset: 0; background-image: linear-gradient(var(--accent-bg) 1px, transparent 1px), linear-gradient(90deg, var(--accent-bg) 1px, transparent 1px); background-size: 56px 56px; }
.cpub-hero-inner { max-width: 1100px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }

.cpub-cancelled-banner { background: var(--red-bg); border: var(--border-width-default) solid var(--red-border); color: var(--red); padding: 10px 14px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }

/* 2-column: details (flex) + countdown (auto width). */
.cpub-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 48px; align-items: start; }
.cpub-hero-main { min-width: 0; }

.cpub-hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.cpub-contest-badge { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent); padding: 3px 10px; border-radius: var(--radius); display: inline-flex; align-items: center; gap: 5px; }
.cpub-contest-badge i { font-size: 8px; }
.cpub-status-pill { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-family: var(--font-mono); padding: 3px 10px; border-radius: var(--radius); border: var(--border-width-default) solid var(--hero-border); color: var(--hero-text-dim); }
.cpub-status-pill[data-status="active"] { color: var(--green); border-color: var(--green); background: color-mix(in srgb, var(--green) 14%, transparent); }
.cpub-status-pill[data-status="judging"] { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.cpub-status-pill[data-status="upcoming"] { color: var(--yellow); border-color: var(--yellow); }
.cpub-status-pill[data-status="paused"] { color: var(--yellow); border-color: var(--yellow); background: color-mix(in srgb, var(--yellow) 12%, transparent); }
.cpub-status-pill[data-status="draft"] { color: var(--hero-text-dim); border-color: var(--hero-border); border-style: dashed; }
.cpub-status-pill[data-status="completed"], .cpub-status-pill[data-status="cancelled"] { color: var(--red); border-color: var(--red-border); }
.cpub-stage-chip { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-family: var(--font-mono); padding: 3px 10px; border-radius: var(--radius); border: var(--border-width-default) solid var(--accent); color: var(--accent); background: var(--accent-bg); display: inline-flex; align-items: center; gap: 5px; }
.cpub-stage-chip i { font-size: 8px; }

.cpub-hero-title { font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; margin: 0 0 10px; color: var(--hero-text); }
.cpub-hero-tagline { font-size: 14px; color: var(--hero-text-dim); line-height: 1.55; max-width: 600px; margin: 0 0 20px; display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.cpub-hero-meta { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); margin-bottom: 24px; }
.cpub-hero-meta-item { display: flex; align-items: center; gap: 6px; }

.cpub-hero-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cpub-btn-lg { padding: 10px 22px; font-size: 13px; }
.cpub-btn-dark { background: var(--hero-surface); color: var(--hero-text); border-color: var(--hero-border); }
.cpub-btn-dark:hover { background: var(--hero-surface); }
.cpub-btn-cancel { color: var(--red); border-color: var(--red-border); }
.cpub-btn-cancel:hover { background: var(--red-bg); }

.cpub-admin-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 18px; padding: 10px 14px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-admin-controls-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-right: 4px; font-family: var(--font-mono); }

/* ── COUNTDOWN (right column) ── */
.cpub-hero-side { display: flex; flex-direction: column; }
.cpub-countdown-section { background: var(--hero-surface); border: var(--border-width-default) solid var(--hero-border); border-radius: var(--radius); padding: 16px 18px; }
.cpub-countdown-label { font-size: 10px; font-family: var(--font-mono); color: var(--hero-text-dim); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.cpub-countdown-label i { color: var(--accent); }
.cpub-countdown-row { display: flex; align-items: flex-start; gap: 8px; }
.cpub-countdown-block { display: flex; flex-direction: column; align-items: center; background: var(--hero-bg); border: var(--border-width-default) solid var(--hero-border); border-radius: var(--radius); padding: 10px 14px; min-width: 56px; }
.cpub-countdown-val { font-size: 24px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); line-height: 1; margin-bottom: 4px; }
.cpub-countdown-unit { font-size: 8px; text-transform: uppercase; letter-spacing: .1em; color: var(--hero-text-dim); font-family: var(--font-mono); }
.cpub-countdown-sep { font-size: 20px; font-weight: 700; color: var(--hero-border); font-family: var(--font-mono); padding-top: 10px; }
.cpub-countdown-ended { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .08em; color: var(--hero-text-dim); background: var(--hero-surface); border: var(--border-width-default) solid var(--hero-border); border-radius: var(--radius); padding: 14px 18px; }
.cpub-countdown-ended i { color: var(--accent); }

/* ── RESPONSIVE ── stack the countdown below the details. */
@media (max-width: 900px) {
  .cpub-hero-grid { grid-template-columns: 1fr; gap: 28px; }
  .cpub-hero-side { align-items: flex-start; }
}
@media (max-width: 768px) {
  .cpub-hero-body { padding: 32px 0; }
  .cpub-hero-inner { padding: 0 16px; }
  .cpub-hero-banner { max-height: 200px; }
  .cpub-hero-title { font-size: 24px; }
  .cpub-hero-meta { gap: 10px; }
}
@media (max-width: 480px) {
  .cpub-hero-title { font-size: 20px; }
  .cpub-hero-tagline { font-size: 12px; margin-bottom: 16px; }
  .cpub-hero-cta { flex-direction: column; align-items: stretch; }
  .cpub-countdown-row { flex-wrap: wrap; justify-content: center; }
  .cpub-countdown-block { min-width: 48px; padding: 8px 12px; }
  .cpub-countdown-val { font-size: 20px; }
}
</style>
