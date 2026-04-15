<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const labelA = computed(() => (props.content.labelA as string) || 'Mode A');
const labelB = computed(() => (props.content.labelB as string) || 'Mode B');
const descA = computed(() => (props.content.descriptionA as string) || '');
const descB = computed(() => (props.content.descriptionB as string) || '');

const activeMode = ref<'A' | 'B'>((props.content.defaultMode as 'A' | 'B') ?? 'A');
</script>

<template>
  <div class="cpub-toggle-module">
    <div class="cpub-toggle-controls">
      <button
        class="cpub-toggle-btn"
        :class="{ 'cpub-toggle-btn-active': activeMode === 'A' }"
        :aria-pressed="activeMode === 'A'"
        @click="activeMode = 'A'"
      >
        {{ labelA }}
      </button>
      <button
        class="cpub-toggle-btn"
        :class="{ 'cpub-toggle-btn-active': activeMode === 'B' }"
        :aria-pressed="activeMode === 'B'"
        @click="activeMode = 'B'"
      >
        {{ labelB }}
      </button>
    </div>

    <div class="cpub-toggle-content">
      <div v-if="activeMode === 'A'" class="cpub-toggle-panel">
        <div v-if="descA" class="cpub-toggle-desc" v-html="descA" />
        <slot name="modeA" />
      </div>
      <div v-else class="cpub-toggle-panel">
        <div v-if="descB" class="cpub-toggle-desc" v-html="descB" />
        <slot name="modeB" />
      </div>
    </div>

    <div class="cpub-toggle-info" aria-live="polite" aria-atomic="true">
      {{ activeMode === 'A' ? labelA : labelB }} selected
    </div>
  </div>
</template>

<style scoped>
.cpub-toggle-module {
  padding: 16px;
}

.cpub-toggle-controls {
  display: flex;
  gap: 2px;
  margin-bottom: 16px;
}

.cpub-toggle-btn {
  flex: 1;
  padding: 10px 16px;
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: transparent;
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.45));
  cursor: pointer;
  transition: all 0.15s;
}

.cpub-toggle-btn:hover {
  color: var(--text-on-dark, #fff);
  border-color: rgba(255, 255, 255, 0.2);
}

.cpub-toggle-btn-active {
  background: var(--accent-light, rgba(224, 64, 48, 0.1));
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-toggle-content {
  min-height: 80px;
}

.cpub-toggle-panel {
  animation: cpub-toggle-fade 0.2s ease;
}

.cpub-toggle-desc {
  font-family: var(--font-body, sans-serif);
  font-size: 14px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.55));
  line-height: 1.6;
  padding: 12px 0;
}

.cpub-toggle-info {
  font-family: var(--font-ui, monospace);
  font-size: 11px;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  padding: 10px 0 0;
  border-top: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.05));
}

@keyframes cpub-toggle-fade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
