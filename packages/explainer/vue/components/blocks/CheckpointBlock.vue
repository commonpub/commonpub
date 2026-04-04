<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ reached: [] }>();

const label = computed(() => (props.content.label as string) || 'Checkpoint reached');
const completed = ref(false);

onMounted(() => {
  completed.value = true;
  emit('reached');
});
</script>

<template>
  <div class="cpub-block-checkpoint" :class="{ visible: completed }">
    <span class="cpub-checkpoint-icon">&#10003;</span>
    <span class="cpub-checkpoint-text">{{ label }}</span>
  </div>
</template>

<style scoped>
.cpub-block-checkpoint { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--green-bg); border: var(--border-width-default) solid var(--green); margin: 24px 0; font-size: 13px; color: var(--green); opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; }
.cpub-block-checkpoint.visible { opacity: 1; transform: translateY(0); }
.cpub-checkpoint-icon { font-size: 14px; font-weight: 700; }
.cpub-checkpoint-text { font-weight: 600; }
</style>
