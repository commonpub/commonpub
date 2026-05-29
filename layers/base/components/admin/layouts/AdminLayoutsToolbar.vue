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

import { onMounted, onBeforeUnmount, ref } from 'vue';

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
  /** ISO timestamp of the last successful save — drives "Saved · 2m ago". */
  lastSavedAt?: string | null;
  /** Phase 3b/B — undo/redo button enablement + tooltip labels. */
  canUndo?: boolean;
  canRedo?: boolean;
  /** Label of the command that undo/redo will apply — shown as the
   *  button's title attribute ("Undo: move hero"). null when stack
   *  is empty (button is disabled then). */
  undoLabel?: string | null;
  redoLabel?: string | null;
}>();

// Relative-time string for the save indicator. Updates every 30s so the
// "Saved · 5s ago" indicator stays current without manual refresh.
// Per UX research synthesis (session 160 audit): the relative time IS
// the trust signal — a bare "Saved" without context erodes user
// confidence ("did my LAST edit save, or one from earlier?").
const now = ref<number>(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  nowTimer = setInterval(() => { now.value = Date.now(); }, 30_000);
});
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer);
});

function relativeTime(iso: string | null | undefined, ref: number): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const deltaSec = Math.max(0, Math.round((ref - t) / 1000));
  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const m = Math.round(deltaSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const savedAgo = computed<string>(() => relativeTime(props.lastSavedAt, now.value));

/**
 * Effective state for the pill — adopts the Strapi 3-state model:
 *   - 'draft': never been published
 *   - 'published': live, no pending changes
 *   - 'modified': live, has un-published draft edits
 * The Modified state is the one most CMSs hide. Surfacing it explicitly
 * gives the admin a clear mental model of "what's live vs what's drafted."
 * Per UX research synthesis (session 160 audit).
 */
const effectiveState = computed<'draft' | 'published' | 'modified'>(() => {
  if (props.state === 'published' && props.dirty) return 'modified';
  return props.state;
});

const STATE_LABELS: Record<'draft' | 'published' | 'modified', string> = {
  draft: 'draft',
  published: 'published',
  modified: 'modified',
};

/** Publish button copy adapts to context per the Strapi model. */
const publishLabel = computed<string>(() => {
  if (effectiveState.value === 'modified') return 'Publish changes';
  if (effectiveState.value === 'published') return 'Republish';
  return 'Publish';
});

/** Publish is disabled when there's nothing meaningful to publish — i.e.,
 * the layout is already live and there are no draft edits. (Republish
 * still works, but only via the explicit menu in a later phase.) */
const publishDisabled = computed<boolean>(() => {
  return props.saveStatus === 'saving' || effectiveState.value === 'published';
});

const emit = defineEmits<{
  (e: 'update:viewport', value: 'mobile' | 'tablet' | 'desktop'): void;
  (e: 'save'): void;
  (e: 'publish'): void;
  (e: 'discard'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
}>();

/* Phase 3b/B — undo/redo button copy. Title attribute shows the
 * specific label of the next command ("Undo: move hero") — this is
 * the discoverable counterpart to the hotkey + a confirmation that the
 * stack actually holds something meaningful before the user clicks. */
const undoTitle = computed<string>(() =>
  props.canUndo && props.undoLabel ? `Undo: ${props.undoLabel} (Cmd+Z)` : 'Undo (Cmd+Z)',
);
const redoTitle = computed<string>(() =>
  props.canRedo && props.redoLabel ? `Redo: ${props.redoLabel} (Cmd+Shift+Z)` : 'Redo (Cmd+Shift+Z)',
);

const indicatorText = computed<string>(() => {
  if (props.saveStatus === 'saving') return 'Saving…';
  if (props.saveStatus === 'conflict') return 'Conflict';
  if (props.saveStatus === 'error') return props.errorMessage ?? 'Save failed';
  if (props.dirty) return 'Unsaved changes';
  // Saved + relative time — "Saved · 2m ago" is the trust signal
  if (props.lastSavedAt) return savedAgo.value ? `Saved · ${savedAgo.value}` : 'Saved';
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
      <span
        class="cpub-admin-layouts-toolbar-state"
        :data-state="effectiveState"
      >{{ STATE_LABELS[effectiveState] }}</span>
    </div>

    <!--
      Session 164 polish: palette/inspector toggles MOVED to edge tabs on the
      panels themselves (see pages/admin/layouts/[id].vue body). The toolbar
      previously hosted these buttons, but the placement was non-obvious —
      collapsing made it unclear where to re-open. The edge tabs at the
      panel/canvas boundary follow the Notion/Linear convention: when
      expanded they sit at the panel's outer edge; when collapsed they sit
      at the screen edge inviting expansion. The icon (« / ») tells the
      direction.
    -->
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

    <!--
      Phase 3b/B — undo / redo. Plan §7.12 toolbar mockup shows '⤺ ⤻'
      between viewport and save indicator. Tooltip carries the next
      command's specific label ("Undo: move hero") so the discoverable
      affordance answers "what will Cmd+Z do?" without taking action.
      Disabled state when stack is empty in that direction; keyboard
      hotkeys (Cmd+Z / Cmd+Shift+Z) live independently in useLayoutHotkeys.
    -->
    <div
      class="cpub-admin-layouts-toolbar-history"
      role="group"
      aria-label="Undo and redo"
    >
      <button
        type="button"
        class="cpub-admin-layouts-toolbar-panel-btn"
        :aria-label="undoTitle"
        :title="undoTitle"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="cpub-admin-layouts-toolbar-panel-btn"
        :aria-label="redoTitle"
        :title="redoTitle"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
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
      <!-- R4 audit P2 fix: Discard button wires useLayoutEditor.discard().
           Enabled only when dirty; emits 'discard' for the parent page to
           confirm + invoke. Previously discard() was implemented but
           unwired — admin's only revert path was page refresh. -->
      <button
        type="button"
        class="cpub-admin-layouts-toolbar-btn"
        :disabled="!dirty || saveStatus === 'saving'"
        @click="emit('discard')"
        title="Discard unsaved changes"
      >
        <i class="fa-solid fa-rotate-left"></i>
        <span>Discard</span>
      </button>
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
        :disabled="publishDisabled"
        @click="emit('publish')"
      >
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>{{ publishLabel }}</span>
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
/* "modified" pill: yellow border + tint background, but theme-safe
   text color (var(--text)) for WCAG contrast. The raw --yellow token
   (#f59e0b) is 2.07:1 on white — fails both AA text (4.5:1) and
   non-text UI (3:1). Pairing border+tint with --text gives the visual
   signal (warning) without the contrast failure. Per session 160
   audit catch. */
.cpub-admin-layouts-toolbar-state[data-state='modified'] {
  color: var(--text);
  background: var(--yellow-bg);
  border-color: var(--yellow);
}

/* Panel toggles (palette + inspector hide/show — session 161 canvas-squish fix).
   Same 28×28 minimum target as viewport buttons (WCAG 2.5.8 AA buffer).
   Visually similar but bordered alone (not grouped) so they don't read as
   part of the viewport segmented control. */
.cpub-admin-layouts-toolbar-panel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text-dim);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: color var(--transition-default), border-color var(--transition-default), background var(--transition-default);
}
.cpub-admin-layouts-toolbar-panel-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.cpub-admin-layouts-toolbar-panel-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* When the panel is hidden (aria-pressed=false), give the button a
   subtle "active" tint so the admin sees it's holding a non-default
   state. Pressed=true means "the panel is visible", which IS default,
   so no tint needed. */
.cpub-admin-layouts-toolbar-panel-btn[aria-pressed='false'] {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
/* Disabled state for undo/redo when stack is empty in that direction.
   The aria-pressed treatment above is for toggle buttons; history
   buttons have no pressed state, so the disabled rule wins on overlap. */
.cpub-admin-layouts-toolbar-panel-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--text-dim);
  border-color: var(--border2);
  background: transparent;
}

/* Group the undo + redo buttons visually so they read as a pair (matches
   the viewport segmented control's grouping discipline). */
.cpub-admin-layouts-toolbar-history {
  display: inline-flex;
  gap: var(--space-1);
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
  /* WCAG 2.5.8 AA — 24×24 minimum target. We use 28×28 (the GitHub
     Primer "small" segmented-control spec) as a buffer + comfort
     adjustment. The visible icon stays ~14px; padding pads the hit area. */
  min-width: 28px;
  min-height: 28px;
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
