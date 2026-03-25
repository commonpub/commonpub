<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ reached: [] }>();

const label = computed(() => (props.content.label as string) || 'Checkpoint reached');
const completed = ref(false);

function markComplete(): void {
  if (completed.value) return;
  completed.value = true;
  emit('reached');
}

onMounted(() => {
  // Auto-trigger when scrolled into view
  markComplete();
});
</script>

<template>
  <div class="cpub-block-checkpoint" :class="{ visible: completed }">
    <i class="fa-solid fa-circle-check"></i>
    <span class="cpub-checkpoint-text">{{ label }}</span>
  </div>
</template>

<style scoped>
.cpub-block-checkpoint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--green-bg);
  border: 2px solid var(--green);
  margin: 24px 0;
  font-size: 13px;
  color: var(--green);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.cpub-block-checkpoint.visible {
  opacity: 1;
  transform: translateY(0);
}

.cpub-block-checkpoint i { font-size: 14px; }
.cpub-checkpoint-text { font-weight: 600; }
</style>
