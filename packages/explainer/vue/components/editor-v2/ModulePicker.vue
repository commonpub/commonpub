<script setup lang="ts">
import { computed } from 'vue';
import { getModulesByCategory, modules } from '../../../modules/registry';
import type { LoadedModule } from '../../../modules/types';

const emit = defineEmits<{
  select: [moduleId: string];
  close: [];
}>();

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Layout',
  input: 'Input',
  display: 'Display',
  simulation: 'Simulation',
  custom: 'Custom',
};

const grouped = computed(() => {
  const map = getModulesByCategory();
  const result: Array<{ category: string; label: string; modules: Array<{ id: string; mod: LoadedModule }> }> = [];
  for (const [cat, mods] of map.entries()) {
    result.push({
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      modules: mods.map(m => ({ id: m.meta.id, mod: m })),
    });
  }
  return result;
});

function handleSelect(moduleId: string): void {
  emit('select', moduleId);
  emit('close');
}
</script>

<template>
  <div class="cpub-module-picker-overlay" @click.self="emit('close')">
    <div class="cpub-module-picker">
      <div class="cpub-module-picker-header">
        <span class="cpub-module-picker-title">Add Section</span>
        <button class="cpub-module-picker-close" @click="emit('close')" aria-label="Close">
          <i class="fa-solid fa-xmark" />
        </button>
      </div>

      <div class="cpub-module-picker-body">
        <div v-for="group in grouped" :key="group.category" class="cpub-module-group">
          <div class="cpub-module-group-label">{{ group.label }}</div>
          <div class="cpub-module-grid">
            <button
              v-for="{ id, mod } in group.modules"
              :key="id"
              class="cpub-module-card"
              @click="handleSelect(id)"
            >
              <span class="cpub-module-icon" :style="{ background: mod.meta.color }">
                <i :class="`fa-solid ${mod.meta.icon}`" />
              </span>
              <div class="cpub-module-info">
                <span class="cpub-module-name">{{ mod.meta.name }}</span>
                <span class="cpub-module-desc">{{ mod.meta.description }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-module-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-module-picker {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  width: 560px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cpub-module-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-module-picker-title {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.cpub-module-picker-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 14px;
}

.cpub-module-picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.cpub-module-group-label {
  padding: 10px 18px 4px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-dim);
}

.cpub-module-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px 18px 12px;
}

.cpub-module-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
}

.cpub-module-card:hover {
  border-color: var(--accent);
}

.cpub-module-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 11px;
  flex-shrink: 0;
}

.cpub-module-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cpub-module-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.cpub-module-desc {
  font-size: 10px;
  color: var(--text-dim);
  line-height: 1.3;
}
</style>
