<script setup lang="ts">
import type { HubTabDef } from '../../types/hub';

defineProps<{
  tabs: HubTabDef[]
}>();

const activeTab = defineModel<string>('activeTab', { required: true });
</script>

<template>
  <div class="cpub-hub-page">
    <slot name="hero" />

    <!-- Tabs -->
    <div class="cpub-hub-tabs">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="cpub-tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          <i :class="tab.icon" style="font-size: 10px"></i>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="cpub-hub-main">
      <div class="cpub-hub-layout">
        <main>
          <slot />
        </main>
        <aside>
          <slot name="sidebar" />
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-hub-tabs {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 48px;
  z-index: 90;
}

.cpub-tabs-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  gap: 4px;
}

.cpub-tab-btn {
  font-size: 0.8125rem;
  color: var(--text-dim);
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: var(--border-width-default) solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  top: 1px;
  transition: color 0.15s;
}

.cpub-tab-btn:hover { color: var(--text); }
.cpub-tab-btn.active { color: var(--accent); border-bottom-color: var(--accent-border); font-weight: 600; }

.cpub-hub-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}

.cpub-hub-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 1024px) {
  .cpub-hub-layout { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .cpub-hub-main { padding: 16px; }
  .cpub-tabs-inner { padding: 0 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cpub-tab-btn { white-space: nowrap; flex-shrink: 0; }
}
</style>
