<script setup lang="ts">
import { computed, type Component } from 'vue';
import type { ModuleConfig } from '@commonpub/explainer';
import { moduleMap } from './moduleMap';
import { getModule } from '../../../modules/registry';

const props = defineProps<{
  module: ModuleConfig;
}>();

const moduleComponent = computed<Component | null>(() => moduleMap[props.module.type] ?? null);
const loadedModule = computed(() => getModule(props.module.type));
const moduleName = computed(() => loadedModule.value?.meta.name ?? props.module.type);
const moduleIcon = computed(() => loadedModule.value?.meta.icon ?? 'fa-sliders-h');
</script>

<template>
  <div class="cpub-interactive-container">
    <!-- Label header -->
    <div class="cpub-interactive-label">
      <i :class="`fa-solid ${moduleIcon}`" />
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
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 0px);
  margin: var(--space-7, 28px) 0;
  overflow: hidden;

  /* Bridge: map explainer theme vars to CommonPub design system vars
     so existing block components (SliderBlock, QuizBlock) render correctly
     inside the dark interactive container */
  --surface: transparent;
  --surface2: rgba(255, 255, 255, 0.06);
  --surface3: rgba(255, 255, 255, 0.1);
  --bg: var(--bg-dark, #141418);
  --text: var(--text-on-dark, rgba(255, 255, 255, 0.85));
  --text-dim: var(--text-on-dark-dim, rgba(255, 255, 255, 0.45));
  --text-faint: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  --border: var(--border-dark, rgba(255, 255, 255, 0.08));
  --border2: rgba(255, 255, 255, 0.06);
  --border-width-default: 1px;
  --shadow-sm: none;
  --shadow-md: none;
}

.cpub-interactive-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  padding: var(--space-2, 10px) var(--space-4, 16px);
  border-bottom: var(--border-width-default, 1px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.cpub-interactive-label i {
  font-size: var(--text-xs, 10px);
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
  padding: var(--space-8, 32px) var(--space-4, 16px);
  text-align: center;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  font-family: var(--font-ui);
  font-size: var(--text-xs, 12px);
}
</style>
