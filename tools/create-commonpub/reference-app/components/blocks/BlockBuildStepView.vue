<script setup lang="ts">
const props = defineProps<{
  content: Record<string, unknown>;
  stepNumber?: number;
}>();

const title = computed(() => (props.content.title as string) || `Step ${props.stepNumber ?? 1}`);
const instructions = computed(() => (props.content.instructions as string) || '');
const time = computed(() => (props.content.time as string) || '');
const image = computed(() => (props.content.image as string) || '');
const num = computed(() => props.stepNumber ?? (props.content.stepNumber as number) ?? 1);
</script>

<template>
  <div class="cpub-block-step">
    <div class="cpub-step-header">
      <span class="cpub-step-num">{{ num }}</span>
      <h3 class="cpub-step-title">{{ title }}</h3>
      <span v-if="time" class="cpub-step-time"><i class="fa-regular fa-clock"></i> {{ time }}</span>
    </div>
    <div class="cpub-step-body">
      <p v-if="instructions">{{ instructions }}</p>
      <img v-if="image" :src="image" :alt="`Step ${num}`" class="cpub-step-img" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-step {
  border: 2px solid var(--border);
  overflow: hidden;
  margin: 20px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--border);
  color: var(--surface);
}

.cpub-step-num {
  width: 28px;
  height: 28px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.cpub-step-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  margin: 0;
}

.cpub-step-time {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cpub-step-body {
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-step-body p { margin: 0 0 12px; }
.cpub-step-body p:last-child { margin-bottom: 0; }

.cpub-step-img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  border: 2px solid var(--border);
  margin-top: 12px;
}
</style>
