<script setup lang="ts">
/**
 * Inspector — right column of the editor shell. Dispatcher: when
 * nothing is selected, show the page-meta form (3a.4); when a row
 * or section is selected, swap to its form (3f).
 *
 * Phase 3a.3 ships the dispatcher + the "nothing selected" branch
 * routing to <AdminLayoutsInspectorPage>. Selection state lands in
 * 3b alongside the drag-drop work.
 */
import type { LayoutRecord } from '@commonpub/server';

defineProps<{ draft: LayoutRecord | null }>();

const emit = defineEmits<{
  /** Bubble up `pageMeta` edits from <AdminLayoutsInspectorPage>. */
  (e: 'update:page-meta', value: LayoutRecord['pageMeta']): void;
  (e: 'update:name', value: string): void;
}>();

function onPageMetaUpdate(value: LayoutRecord['pageMeta']): void {
  emit('update:page-meta', value);
}
function onNameUpdate(value: string): void {
  emit('update:name', value);
}
</script>

<template>
  <aside class="cpub-admin-layouts-inspector" aria-label="Inspector">
    <header class="cpub-admin-layouts-inspector-header">
      <h2 class="cpub-admin-layouts-inspector-title">Inspector</h2>
      <p class="cpub-admin-layouts-inspector-hint">
        Page meta. Section + row inspectors arrive with drag-drop.
      </p>
    </header>

    <div v-if="!draft" class="cpub-admin-layouts-inspector-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>Loading…</span>
    </div>

    <AdminLayoutsInspectorPage
      v-else
      :draft="draft"
      @update:page-meta="onPageMetaUpdate"
      @update:name="onNameUpdate"
    />
  </aside>
</template>

<style scoped>
.cpub-admin-layouts-inspector {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border-left: var(--border-width-default) solid var(--border);
  overflow-y: auto;
  height: 100%;
}

.cpub-admin-layouts-inspector-header { border-bottom: 1px solid var(--border2); padding-bottom: var(--space-3); }
.cpub-admin-layouts-inspector-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-dim);
  margin: 0 0 var(--space-1) 0;
  font-weight: var(--font-weight-semibold);
}
.cpub-admin-layouts-inspector-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
}

.cpub-admin-layouts-inspector-loading {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-4);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
