<script setup lang="ts">
defineProps<{
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
}>();

const leftOpen = ref(false);
const rightOpen = ref(false);

function toggleLeft(): void {
  leftOpen.value = !leftOpen.value;
  if (leftOpen.value) rightOpen.value = false;
}

function toggleRight(): void {
  rightOpen.value = !rightOpen.value;
  if (rightOpen.value) leftOpen.value = false;
}
</script>

<template>
  <div class="cpub-editor-shell-inner">
    <!-- Mobile sidebar toggles -->
    <div class="cpub-editor-mobile-toggles">
      <button v-if="showLeftSidebar" class="cpub-editor-toggle-btn" aria-label="Toggle blocks panel" @click="toggleLeft">
        <i class="fa-solid fa-layer-group"></i>
      </button>
      <button v-if="showRightSidebar" class="cpub-editor-toggle-btn" aria-label="Toggle properties panel" @click="toggleRight">
        <i class="fa-solid fa-sliders"></i>
      </button>
    </div>

    <!-- Left sidebar -->
    <aside
      v-if="showLeftSidebar"
      class="cpub-editor-left"
      :class="{ 'cpub-editor-sidebar-open': leftOpen }"
      aria-label="Editor sidebar"
    >
      <slot name="left" />
    </aside>

    <!-- Overlay for mobile sidebars -->
    <div v-if="leftOpen || rightOpen" class="cpub-editor-overlay" @click="leftOpen = false; rightOpen = false" />

    <div class="cpub-editor-center">
      <slot />
    </div>

    <!-- Right sidebar -->
    <aside
      v-if="showRightSidebar"
      class="cpub-editor-right"
      :class="{ 'cpub-editor-sidebar-open': rightOpen }"
      aria-label="Properties"
    >
      <slot name="right" />
    </aside>
  </div>
</template>

<style scoped>
.cpub-editor-shell-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.cpub-editor-left {
  width: 220px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 2px solid var(--border);
  overflow-y: auto;
  padding: var(--space-4);
}

.cpub-editor-center {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  background: var(--bg);
}

.cpub-editor-right {
  width: 280px;
  flex-shrink: 0;
  background: var(--surface);
  border-left: 2px solid var(--border);
  overflow-y: auto;
  padding: var(--space-4);
}

.cpub-editor-mobile-toggles {
  display: none;
}

.cpub-editor-overlay {
  display: none;
}

@media (max-width: 1024px) {
  .cpub-editor-left,
  .cpub-editor-right {
    position: fixed;
    top: 0;
    bottom: 0;
    z-index: var(--z-modal, 200);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .cpub-editor-left {
    left: 0;
  }

  .cpub-editor-right {
    right: 0;
    left: auto;
    transform: translateX(100%);
  }

  .cpub-editor-left.cpub-editor-sidebar-open {
    transform: translateX(0);
  }

  .cpub-editor-right.cpub-editor-sidebar-open {
    transform: translateX(0);
  }

  .cpub-editor-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: calc(var(--z-modal, 200) - 1);
  }

  .cpub-editor-mobile-toggles {
    display: flex;
    position: fixed;
    bottom: var(--space-4);
    right: var(--space-4);
    gap: var(--space-2);
    z-index: var(--z-fixed, 100);
  }

  .cpub-editor-toggle-btn {
    width: 44px;
    height: 44px;
    border: 2px solid var(--border);
    background: var(--surface);
    color: var(--text-dim);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-md, 4px 4px 0 var(--border));
  }

  .cpub-editor-toggle-btn:hover {
    background: var(--surface2);
    color: var(--text);
  }
}
</style>
