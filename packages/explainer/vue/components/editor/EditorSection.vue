<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  icon?: string;
  open?: boolean;
}>(), { open: true });

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <div class="cpub-ep-section">
    <button class="cpub-ep-section-header" @click="emit('toggle')">
      <span class="cpub-ep-section-label">{{ title }}</span>
      <span class="cpub-ep-section-arrow" :class="{ collapsed: !open }">&rsaquo;</span>
    </button>
    <div v-if="open" class="cpub-ep-section-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-ep-section { border-bottom: 1px solid var(--border2); }
.cpub-ep-section-header { display: flex; align-items: center; width: 100%; padding: 10px 14px; background: none; border: none; cursor: pointer; color: var(--text); font-size: 11px; font-weight: 600; font-family: var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; }
.cpub-ep-section-header:hover { background: var(--surface2); }
.cpub-ep-section-label { flex: 1; text-align: left; }
.cpub-ep-section-arrow { font-size: 14px; color: var(--text-faint); transition: transform 0.15s; }
.cpub-ep-section-arrow.collapsed { transform: rotate(-90deg); }
.cpub-ep-section-body { padding: 10px 14px 14px; }
</style>
