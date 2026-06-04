<script setup lang="ts">
const props = defineProps<{
  targetDate: string;
  /** Tight single-line variant for listing cards (no big boxes, seconds dropped). */
  compact?: boolean;
}>();

const timeLeft = ref({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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
onMounted(() => { update(); timer = setInterval(update, 1000); });
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div v-if="compact" class="cpub-countdown-compact">
    <i class="fa-regular fa-clock"></i>
    <span class="cpub-countdown-compact-time">
      <template v-if="timeLeft.days > 0">{{ timeLeft.days }}d </template>{{ String(timeLeft.hours).padStart(2, '0') }}h {{ String(timeLeft.minutes).padStart(2, '0') }}m
    </span>
    <span class="cpub-countdown-compact-label">left</span>
  </div>
  <div v-else class="cpub-countdown">
    <div v-for="(val, key) in timeLeft" :key="key" class="cpub-countdown-unit">
      <span class="cpub-countdown-num">{{ String(val).padStart(2, '0') }}</span>
      <span class="cpub-countdown-label">{{ key }}</span>
    </div>
  </div>
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
</style>
