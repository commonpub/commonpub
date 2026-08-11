<script setup lang="ts">
const props = defineProps<{
  targetDate: string;
  /** Tight single-line variant for listing cards (no big boxes, seconds dropped). */
  compact?: boolean;
}>();

const timeLeft = ref({ days: 0, hours: 0, minutes: 0, seconds: 0 });

// A countdown is clock-dependent, so it cannot be server-rendered: the server
// computes the remaining time at RESPONSE time in the server's zone and the
// client recomputes it at HYDRATION time in the viewer's, and the two disagree.
// Until session 253 this component simply seeded every unit to 0 and only ran
// `update()` in onMounted, so the SSR HTML said "00h 00m left" on every contest
// tile and "00 days 00 hours" on the homepage — which is what crawlers indexed
// and what every visitor saw for one frame.
//
// Fix follows the pattern ContestHero.vue:46,149 already uses: render nothing
// live until mounted, keep a machine-readable <time datetime> in the SSR output
// so the deadline is still in the markup, and reserve the row's height so the
// card does not shift when the real value arrives.
const mounted = ref(false);

function update(): void {
  const diff = new Date(props.targetDate).getTime() - Date.now();
  if (diff <= 0) {
    timeLeft.value = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return;
  }
  timeLeft.value = {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

let timer: ReturnType<typeof setInterval>;
onMounted(() => { mounted.value = true; update(); timer = setInterval(update, 1000); });
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div v-if="compact" class="cpub-countdown-compact">
    <template v-if="mounted">
      <i class="fa-regular fa-clock"></i>
      <span class="cpub-countdown-compact-time">
        <template v-if="timeLeft.days > 0">{{ timeLeft.days }}d </template>{{ String(timeLeft.hours).padStart(2, '0') }}h {{ String(timeLeft.minutes).padStart(2, '0') }}m
      </span>
      <span class="cpub-countdown-compact-label">left</span>
    </template>
    <time v-else :datetime="targetDate" class="cpub-countdown-ssr" />
  </div>
  <div v-else-if="mounted" class="cpub-countdown">
    <div v-for="(val, key) in timeLeft" :key="key" class="cpub-countdown-unit">
      <span class="cpub-countdown-num">{{ String(val).padStart(2, '0') }}</span>
      <span class="cpub-countdown-label">{{ key }}</span>
    </div>
  </div>
  <time v-else :datetime="targetDate" class="cpub-countdown cpub-countdown-ssr" />
</template>

<style scoped>
.cpub-countdown {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.cpub-countdown-unit {
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  padding: 10px 4px;
  text-align: center;
}

.cpub-countdown-num {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  line-height: 1;
  display: block;
}

.cpub-countdown-label {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: block;
  margin-top: 4px;
}

/* Compact card variant — one tight line, no boxes. */
.cpub-countdown-compact {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.cpub-countdown-compact > .fa-clock {
  font-size: 11px;
  color: var(--text-faint);
  align-self: center;
}

.cpub-countdown-compact-time {
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.01em;
}

.cpub-countdown-compact-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

/* Pre-mount placeholder: carries the deadline for machines, occupies the height
   the live value will need so hydration does not shift the layout. */
.cpub-countdown-ssr {
  display: block;
  min-height: 1em;
}
.cpub-countdown.cpub-countdown-ssr {
  min-height: 52px; /* one .cpub-countdown-unit: 10+22+4+9+10 + 2px borders */
}
</style>
