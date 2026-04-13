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
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function pad(n: number): string { return String(n).padStart(2, '0'); }

function updateCountdown(): void {
  const target = c.value?.endDate ? new Date(c.value.endDate) : new Date();
  const now = new Date();
  let diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
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
  if (c.value?.status === 'completed' || c.value?.status === 'cancelled') return 'Contest ended';
  if (c.value?.status === 'judging') return 'Judging ends in';
  return 'Submissions close in';
});

const isEnded = computed(() => c.value?.status === 'completed' || c.value?.status === 'cancelled');
</script>

<template>
  <div class="cpub-hero">
    <div class="cpub-hero-pattern">
      <div class="cpub-hero-dots"></div>
      <div class="cpub-hero-lines"></div>
    </div>

    <div class="cpub-hero-inner">
      <div class="cpub-hero-eyebrow">
        <span class="cpub-contest-badge"><i class="fa fa-trophy"></i> Contest</span>
      </div>

      <div class="cpub-hero-title">{{ c?.title || 'Contest' }}</div>
      <div class="cpub-hero-tagline">{{ c?.description || 'No description available.' }}</div>

      <div class="cpub-hero-meta">
        <span v-if="c?.startDate || c?.endDate" class="cpub-hero-meta-item">
          <i class="fa fa-calendar"></i>
          {{ c?.startDate ? new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }}{{ c?.startDate && c?.endDate ? ' — ' : '' }}{{ c?.endDate ? new Date(c.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }}
        </span>
        <span v-if="c?.startDate || c?.endDate" class="cpub-hero-meta-sep">|</span>
        <span class="cpub-hero-meta-item"><i class="fa fa-folder-open"></i> {{ c?.entryCount ?? 0 }} entries</span>
      </div>

      <!-- COUNTDOWN -->
      <div v-if="!isEnded" class="cpub-countdown-section">
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

      <div class="cpub-hero-cta">
        <button v-if="isAuthenticated && c?.status === 'active'" class="cpub-btn cpub-btn-primary cpub-btn-lg" @click="emit('submit-entry')"><i class="fa fa-upload"></i> Submit Entry</button>
        <button class="cpub-btn cpub-btn-lg cpub-btn-dark" @click="emit('copy-link')"><i class="fa fa-link"></i> Share</button>
      </div>

      <!-- Admin controls -->
      <div v-if="isAdmin && c" class="cpub-admin-controls">
        <span class="cpub-admin-controls-label"><i class="fa-solid fa-shield-halved"></i> Admin</span>
        <button v-if="c.status === 'upcoming'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="emit('transition', 'active')"><i class="fa-solid fa-play"></i> Activate</button>
        <button v-if="c.status === 'active'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="emit('transition', 'judging')"><i class="fa-solid fa-gavel"></i> Start Judging</button>
        <button v-if="c.status === 'judging'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="emit('transition', 'completed')"><i class="fa-solid fa-check"></i> Complete</button>
        <button v-if="c.status !== 'completed' && c.status !== 'cancelled'" class="cpub-btn cpub-btn-sm cpub-btn-cancel" :disabled="transitioning" @click="emit('transition', 'cancelled')"><i class="fa-solid fa-ban"></i> Cancel</button>
        <span class="cpub-admin-status">Status: <strong>{{ c.status }}</strong></span>
      </div>

      <div class="cpub-hero-stats">
        <div class="cpub-hero-stat">
          <div class="cpub-hero-stat-val">{{ c?.entryCount ?? 0 }}</div>
          <div class="cpub-hero-stat-label">Entries</div>
        </div>
        <div class="cpub-hero-stat">
          <div class="cpub-hero-stat-val">{{ c?.status ?? 'draft' }}</div>
          <div class="cpub-hero-stat-label">Status</div>
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
  --hero-border: rgba(255, 255, 255, 0.15);
  --hero-surface: rgba(255, 255, 255, 0.06);
  position: relative; overflow: hidden; background: var(--hero-bg); padding: 56px 0 48px;
}
.cpub-hero-pattern { position: absolute; inset: 0; }
.cpub-hero-dots { position: absolute; inset: 0; background-image: radial-gradient(var(--accent-border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: .3; }
.cpub-hero-lines { position: absolute; inset: 0; background-image: linear-gradient(var(--accent-bg) 1px, transparent 1px), linear-gradient(90deg, var(--accent-bg) 1px, transparent 1px); background-size: 56px 56px; }
.cpub-hero-inner { max-width: 1100px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
.cpub-hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cpub-contest-badge { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent); padding: 3px 10px; border-radius: var(--radius); display: inline-flex; align-items: center; gap: 5px; }
.cpub-contest-badge i { font-size: 8px; }
.cpub-hero-title { font-size: 36px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; margin-bottom: 10px; color: var(--hero-text); }
.cpub-hero-tagline { font-size: 14px; color: var(--hero-text-dim); line-height: 1.55; max-width: 580px; margin-bottom: 28px; }
.cpub-hero-meta { display: flex; align-items: center; gap: 20px; font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); margin-bottom: 28px; }
.cpub-hero-meta-item { display: flex; align-items: center; gap: 5px; }
.cpub-hero-meta-sep { color: var(--hero-border); }

.cpub-countdown-section { margin-bottom: 28px; }
.cpub-countdown-label { font-size: 10px; font-family: var(--font-mono); color: var(--hero-text-dim); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }
.cpub-countdown-label i { color: var(--accent); }
.cpub-countdown-row { display: flex; align-items: center; gap: 8px; }
.cpub-countdown-block { display: flex; flex-direction: column; align-items: center; background: var(--hero-surface); border: var(--border-width-default) solid var(--hero-border); border-radius: var(--radius); padding: 10px 16px; min-width: 60px; box-shadow: 4px 4px 0 var(--hero-surface); }
.cpub-countdown-val { font-size: 26px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); line-height: 1; margin-bottom: 4px; }
.cpub-countdown-unit { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--hero-text-dim); font-family: var(--font-mono); }
.cpub-countdown-sep { font-size: 20px; font-weight: 700; color: var(--hero-border); margin-top: -8px; font-family: var(--font-mono); }

.cpub-hero-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cpub-btn-lg { padding: 10px 22px; font-size: 13px; }
.cpub-btn-dark { background: var(--hero-surface); color: var(--hero-text); border-color: var(--hero-border); }
.cpub-btn-dark:hover { background: var(--hero-surface); }
.cpub-btn-cancel { color: var(--red); border-color: var(--red-border); }
.cpub-btn-cancel:hover { background: var(--red-bg); }

.cpub-hero-stats { display: flex; gap: 24px; margin-top: 28px; padding-top: 24px; border-top: var(--border-width-default) solid var(--hero-border); }
.cpub-hero-stat { display: flex; flex-direction: column; }
.cpub-hero-stat-val { font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); }
.cpub-hero-stat-label { font-size: 10px; color: var(--hero-text-dim); text-transform: uppercase; letter-spacing: .1em; font-family: var(--font-mono); }

.cpub-admin-controls { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 14px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-admin-controls-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-right: 4px; font-family: var(--font-mono); }
.cpub-admin-status { font-size: 11px; color: var(--text-dim); margin-left: auto; font-family: var(--font-mono); }
.cpub-admin-status strong { color: var(--accent); text-transform: capitalize; }

@media (max-width: 768px) {
  .cpub-hero { padding: 32px 0 28px; }
  .cpub-hero-inner { padding: 0 16px; }
  .cpub-hero-title { font-size: 24px; }
  .cpub-hero-tagline { font-size: 13px; }
  .cpub-hero-meta { flex-wrap: wrap; gap: 10px; }
  .cpub-countdown-block { padding: 8px 12px; min-width: 48px; }
  .cpub-countdown-val { font-size: 20px; }
}
@media (max-width: 480px) {
  .cpub-hero-title { font-size: 20px; }
  .cpub-hero-tagline { font-size: 12px; margin-bottom: 16px; }
  .cpub-hero-stats { flex-wrap: wrap; gap: 16px; }
  .cpub-hero-stat-val { font-size: 16px; }
  .cpub-hero-cta { flex-direction: column; align-items: stretch; }
  .cpub-countdown-row { flex-wrap: wrap; justify-content: center; }
}
</style>
