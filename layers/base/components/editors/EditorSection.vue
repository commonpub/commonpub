<script setup lang="ts">
/**
 * Collapsible section for editor property panels.
 * Reused across all editor types.
 */
defineProps<{
  title: string;
  icon: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <div class="cpub-ep-section" :class="{ collapsed: !open }">
    <button class="cpub-ep-section-header" @click="emit('toggle')">
      <i :class="['fa', icon, 'cpub-ep-sec-icon']"></i>
      <span class="cpub-ep-sec-label">{{ title }}</span>
      <i class="fa-solid fa-chevron-down cpub-ep-sec-arrow"></i>
    </button>
    <div v-if="open" class="cpub-ep-section-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-ep-section {
  border-bottom: 2px solid var(--border);
}

.cpub-ep-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
}

.cpub-ep-section-header:hover {
  background: var(--surface2);
}

.cpub-ep-sec-icon {
  font-size: 10px;
  color: var(--text-faint);
  width: 14px;
  text-align: center;
}

.cpub-ep-sec-label {
  flex: 1;
}

.cpub-ep-sec-arrow {
  font-size: 9px;
  color: var(--text-faint);
  transition: transform 0.15s;
}

.collapsed .cpub-ep-sec-arrow {
  transform: rotate(-90deg);
}

.cpub-ep-section-body {
  padding: 8px 12px 14px;
}
</style>
