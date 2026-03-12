<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'CpubProgressBar' });

interface Props {
  value: number;
  max?: number;
  variant?: 'accent' | 'green' | 'yellow' | 'red';
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  variant: 'accent',
});

const percentage = computed(() => {
  const clamped = Math.min(Math.max(props.value, 0), props.max);
  return (clamped / props.max) * 100;
});
</script>

<template>
  <div
    v-bind="$attrs"
    class="cpub-progress"
    role="progressbar"
    :aria-valuenow="props.value"
    :aria-valuemin="0"
    :aria-valuemax="props.max"
  >
    <div
      :class="['cpub-progress__fill', `cpub-progress__fill--${props.variant}`]"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>

<style scoped>
.cpub-progress {
  width: 100%;
  height: 6px;
  background-color: var(--surface3);
  border-radius: var(--radius);
  overflow: hidden;
}

.cpub-progress__fill {
  height: 100%;
  transition: width var(--transition-default);
  border-radius: var(--radius);
}

.cpub-progress__fill--accent {
  background-color: var(--accent);
}

.cpub-progress__fill--green {
  background-color: var(--green);
}

.cpub-progress__fill--yellow {
  background-color: var(--yellow);
}

.cpub-progress__fill--red {
  background-color: var(--red);
}
</style>
