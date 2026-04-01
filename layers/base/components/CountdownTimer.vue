<script setup lang="ts">
const props = defineProps<{
  targetDate: string;
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
  <div class="cpub-countdown">
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
</style>
