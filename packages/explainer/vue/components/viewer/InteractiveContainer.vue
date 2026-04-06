<script setup lang="ts">
import { computed, type Component } from 'vue';
import type { ModuleConfig } from '@commonpub/explainer';
import { moduleMap } from './moduleMap';

const props = defineProps<{
  module: ModuleConfig;
}>();

const moduleComponent = computed<Component | null>(() => moduleMap[props.module.type] ?? null);
const moduleName = computed(() => {
  const names: Record<string, string> = {
    slider: 'Slider + Canvas',
    quiz: 'Knowledge Check',
    toggle: 'Toggle Compare',
    'reveal-cards': 'Reveal Cards',
    'custom-html': 'Custom Interactive',
  };
  return names[props.module.type] ?? props.module.type;
});
</script>

<template>
  <div class="cpub-interactive-container">
    <!-- Label header -->
    <div class="cpub-interactive-label">
      <i class="fa-solid fa-sliders-h" />
      <span>{{ moduleName }}</span>
    </div>

    <!-- Module viewer -->
    <div class="cpub-interactive-content">
      <component
        v-if="moduleComponent"
        :is="moduleComponent"
        :content="module.props"
      />
      <div v-else class="cpub-interactive-missing">
        <span>Module "{{ module.type }}" not available</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-interactive-container {
  background: var(--bg-dark, #141418);
  border: 1px solid var(--border-dark, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 0px);
  margin: 28px 0;
  overflow: hidden;
}

.cpub-interactive-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-dark, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-interactive-label i {
  font-size: 10px;
}

.cpub-interactive-content {
  padding: 0;
}

.cpub-interactive-content :deep(.cpub-slider-block),
.cpub-interactive-content :deep(.cpub-quiz-block) {
  border: none;
  box-shadow: none;
  background: transparent;
}

.cpub-interactive-missing {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  font-family: var(--font-ui);
  font-size: 12px;
}
</style>
