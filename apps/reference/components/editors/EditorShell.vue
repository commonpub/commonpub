<script setup lang="ts">
defineProps<{
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
}>();
</script>

<template>
  <div class="cpub-editor-shell-inner">
    <aside v-if="showLeftSidebar" class="cpub-editor-left" aria-label="Editor sidebar">
      <slot name="left" />
    </aside>
    <div class="cpub-editor-center">
      <slot />
    </div>
    <aside v-if="showRightSidebar" class="cpub-editor-right" aria-label="Properties">
      <slot name="right" />
    </aside>
  </div>
</template>

<style scoped>
.cpub-editor-shell-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
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

@media (max-width: 1024px) {
  .cpub-editor-left,
  .cpub-editor-right {
    display: none;
  }
}
</style>
