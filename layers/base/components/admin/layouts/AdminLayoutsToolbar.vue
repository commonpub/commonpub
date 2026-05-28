<script setup lang="ts">
/**
 * Editor toolbar (Phase 3a.5).
 *
 * Sticky top strip: breadcrumb back to /admin/layouts + layout name +
 * state pill + viewport segmented control + save-status text +
 * Save (manual) + Publish buttons.
 *
 * Viewport is a UI-only concern (translates to a max-width cap on the
 * canvas) — the actual responsive resolution happens at runtime via
 * the section's `responsive.{sm,md,lg}` colSpans. Picking "mobile"
 * here doesn't mutate the layout; it just previews the reflow.
 *
 * Save indicator strings match docs/plans/layout-and-pages.md §7.13:
 *   - 'Saved' (saved, no dirt)
 *   - 'Saving…' (in flight)
 *   - 'Unsaved changes' (dirty, idle)
 *   - 'Save failed' (last save errored)
 *   - 'Conflict' (last save returned 409 — caller surfaces a modal)
 */
import type { LayoutRecord } from '@commonpub/server';

const props = defineProps<{
  /** Layout name (read from draft so renames show live). */
  layoutName: string;
  /** Draft state pill — draft vs published. */
  state: 'draft' | 'published';
  /** Current viewport — drives the segmented control's pressed state. */
  viewport: 'mobile' | 'tablet' | 'desktop';
  /** Save status — drives the indicator text + color. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  /** True when draft != original. */
  dirty: boolean;
  /** Friendly error text (only shown when saveStatus==='error'). */
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:viewport', value: 'mobile' | 'tablet' | 'desktop'): void;
  (e: 'save'): void;
  (e: 'publish'): void;
}>();

const indicatorText = computed<string>(() => {
  if (props.saveStatus === 'saving') return 'Saving…';
  if (props.saveStatus === 'conflict') return 'Conflict';
  if (props.saveStatus === 'error') return props.errorMessage ?? 'Save failed';
  if (props.dirty) return 'Unsaved changes';
  if (props.saveStatus === 'saved') return 'Saved';
  return '';
});

const indicatorTone = computed<'neutral' | 'pending' | 'success' | 'error'>(() => {
  if (props.saveStatus === 'saving') return 'pending';
  if (props.saveStatus === 'error' || props.saveStatus === 'conflict') return 'error';
  if (props.saveStatus === 'saved' && !props.dirty) return 'success';
  return 'neutral';
});

const VIEWPORTS: Array<{ value: 'mobile' | 'tablet' | 'desktop'; icon: string; label: string }> = [
  { value: 'mobile', icon: 'fa-solid fa-mobile-screen', label: 'Mobile' },
  { value: 'tablet', icon: 'fa-solid fa-tablet-screen-button', label: 'Tablet' },
  { value: 'desktop', icon: 'fa-solid fa-display', label: 'Desktop' },
];
</script>

<template>
  <header class="cpub-admin-layouts-toolbar" role="toolbar" aria-label="Editor toolbar">
    <NuxtLink to="/admin/layouts" class="cpub-admin-layouts-toolbar-back">
      <i class="fa-solid fa-chevron-left"></i>
      <span>Layouts</span>
    </NuxtLink>

    <div class="cpub-admin-layouts-toolbar-title">
      <span class="cpub-admin-layouts-toolbar-name">{{ layoutName || '—' }}</span>
      <span class="cpub-admin-layouts-toolbar-state" :data-state="state">{{ state }}</span>
    </div>

    <div
      class="cpub-admin-layouts-toolbar-viewport"
      role="radiogroup"
      aria-label="Preview viewport"
    >
      <button
        v-for="vp in VIEWPORTS"
        :key="vp.value"
        type="button"
        class="cpub-admin-layouts-toolbar-viewport-btn"
        :aria-label="vp.label"
        :aria-pressed="viewport === vp.value"
        :data-active="viewport === vp.value"
        @click="emit('update:viewport', vp.value)"
      >
        <i :class="vp.icon"></i>
      </button>
    </div>

    <div
      class="cpub-admin-layouts-toolbar-indicator"
      :data-tone="indicatorTone"
      role="status"
      aria-live="polite"
    >
      <i v-if="saveStatus === 'saving'" class="fa-solid fa-circle-notch fa-spin"></i>
      <i v-else-if="saveStatus === 'saved' && !dirty" class="fa-solid fa-check"></i>
      <i v-else-if="saveStatus === 'error' || saveStatus === 'conflict'" class="fa-solid fa-triangle-exclamation"></i>
      <span>{{ indicatorText }}</span>
    </div>

    <div class="cpub-admin-layouts-toolbar-actions">
      <button
        type="button"
        class="cpub-admin-layouts-toolbar-btn"
        :disabled="!dirty || saveStatus === 'saving'"
        @click="emit('save')"
      >
        <i class="fa-solid fa-floppy-disk"></i>
        <span>Save</span>
      </button>
      <button
        type="button"
        class="cpub-admin-layouts-toolbar-btn cpub-admin-layouts-toolbar-btn--primary"
        :disabled="saveStatus === 'saving'"
        @click="emit('publish')"
      >
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>Publish</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.cpub-admin-layouts-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  flex: 0 0 auto;
}

.cpub-admin-layouts-toolbar-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-dim);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}
.cpub-admin-layouts-toolbar-back:hover { color: var(--accent); }
.cpub-admin-layouts-toolbar-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cpub-admin-layouts-toolbar-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.cpub-admin-layouts-toolbar-name {
  font-size: var(--text-base);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cpub-admin-layouts-toolbar-state {
  display: inline-block;
  padding: 2px var(--space-2);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid var(--border2);
  color: var(--text-dim);
}
.cpub-admin-layouts-toolbar-state[data-state='published'] {
  color: var(--accent);
  border-color: var(--accent);
}

.cpub-admin-layouts-toolbar-viewport {
  display: inline-flex;
  background: var(--surface2);
  border: 1px solid var(--border2);
}
.cpub-admin-layouts-toolbar-viewport-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 0;
  color: var(--text-dim);
  cursor: pointer;
  font-size: var(--text-sm);
}
.cpub-admin-layouts-toolbar-viewport-btn:hover { color: var(--text); }
.cpub-admin-layouts-toolbar-viewport-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.cpub-admin-layouts-toolbar-viewport-btn[data-active='true'] {
  background: var(--surface);
  color: var(--accent);
}

.cpub-admin-layouts-toolbar-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  min-width: 140px;
}
.cpub-admin-layouts-toolbar-indicator[data-tone='neutral'] { color: var(--text-dim); }
.cpub-admin-layouts-toolbar-indicator[data-tone='pending'] { color: var(--text-dim); }
.cpub-admin-layouts-toolbar-indicator[data-tone='success'] { color: var(--accent); }
.cpub-admin-layouts-toolbar-indicator[data-tone='error'] { color: var(--red); }

.cpub-admin-layouts-toolbar-actions { display: inline-flex; gap: var(--space-2); }

.cpub-admin-layouts-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
}
.cpub-admin-layouts-toolbar-btn:hover:not(:disabled) {
  background: var(--surface2);
  border-color: var(--accent);
}
.cpub-admin-layouts-toolbar-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-admin-layouts-toolbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-admin-layouts-toolbar-btn--primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.cpub-admin-layouts-toolbar-btn--primary:hover:not(:disabled) {
  background: var(--accent);
  filter: brightness(1.1);
  color: var(--surface);
}
</style>
