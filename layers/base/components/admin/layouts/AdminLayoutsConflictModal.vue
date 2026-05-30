<script setup lang="ts">
/**
 * Conflict resolution modal — appears when the server returns 409
 * on a save (another admin edited the layout in the same window).
 *
 * Phase 3a.6 ships THREE options (per session-160 UX audit — the
 * two-option pattern forces a misclick risk; the safe-middle option
 * lets the user step back without committing):
 *   - "Reload their version" — re-fetch from server; LOCAL CHANGES LOST.
 *     This is the default-focused safe action.
 *   - "Keep editing here" — closes the modal; the user can copy text
 *     out or decide later. Sticky banner reminds them they're in conflict.
 *   - "Overwrite their changes" — re-send PUT without If-Match; their
 *     edits are lost. Styled destructive; not at button-peer level with
 *     the safe options (right side, red border).
 *
 * Per UX research synthesis (Notion/XWiki/Webflow patterns): "Force
 * save" terminology is bureaucratic and doesn't name the consequence.
 * "Overwrite their changes" names what actually happens. A real block-
 * level diff is deferred to Phase 7 (versioning UI).
 */

import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  /** Show/hide the modal. */
  open: boolean;
  /** Optional error message from the server. */
  message?: string | null;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'force-save'): void;
  (e: 'close'): void;
}>();

// Focus the safe primary action when the modal opens. WCAG dialog
// pattern: initial focus on the recommended-action button so screen
// readers + keyboard users land on the safe choice, not the destructive
// one. (Tab can still walk to the destructive button after.)
//
// `immediate: true` so initial mounting with :open=true also focuses
// (catches the common-case where the parent toggles conflictOpen=true
// and Vue re-renders the modal subtree from scratch).
const primaryBtn = ref<HTMLButtonElement | null>(null);
const dialogEl = ref<HTMLElement | null>(null);
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      primaryBtn.value?.focus();
    }
  },
  { immediate: true },
);

// Esc to dismiss (per dialog ARIA pattern). The :open guard makes this
// a no-op when the modal is closed; listener attached on client mount only.
function onKeydown(e: KeyboardEvent): void {
  if (props.open && e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

// Focus trap (session 165 round 5 — mirrors HelpOverlay's pattern).
// When focus leaves the dialog while open, snap it back to the
// safe-action primary button. The `dialog.contains(target)` check
// allows free focus movement within the dialog (Tab walks Reload →
// Keep editing → Overwrite, then wraps back to Reload via snap-back).
// Forward-compatible — any future focusable added inside the dialog
// naturally participates via the contains check.
//
// Topmost-only guard: if a later-mounted dialog is on top (rare; the
// editor doesn't normally stack modals, and the parent coordinator
// in [id].vue closes HelpOverlay when this one opens), let that
// dialog's own trap own focus. Without the guard, two modals' traps
// would fight in a focus ping-pong.
function isTopmostDialog(): boolean {
  if (typeof document === 'undefined') return false;
  if (!dialogEl.value) return false;
  const all = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  return all[all.length - 1] === dialogEl.value;
}
function onFocusIn(e: FocusEvent): void {
  if (!props.open) return;
  if (!isTopmostDialog()) return;
  const target = e.target as Node | null;
  if (!target) return;
  const dlg = dialogEl.value;
  if (!dlg) return;
  if (dlg.contains(target)) return;
  primaryBtn.value?.focus();
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusIn);
  }
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
    document.removeEventListener('focusin', onFocusIn);
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="cpub-admin-layouts-conflict-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <div
        ref="dialogEl"
        class="cpub-admin-layouts-conflict-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cpub-admin-layouts-conflict-title"
        aria-describedby="cpub-admin-layouts-conflict-body"
      >
        <header class="cpub-admin-layouts-conflict-header">
          <i class="fa-solid fa-triangle-exclamation cpub-admin-layouts-conflict-icon"></i>
          <h2 id="cpub-admin-layouts-conflict-title" class="cpub-admin-layouts-conflict-title">
            Version conflict
          </h2>
        </header>
        <div id="cpub-admin-layouts-conflict-body" class="cpub-admin-layouts-conflict-body">
          <p>{{ message ?? 'Another admin saved this layout while you were editing.' }}</p>
          <p class="cpub-admin-layouts-conflict-body-hint">
            Reload their version (recommended) — or keep your edits visible so you can copy what
            you need before deciding. Overwriting their changes is destructive and final.
          </p>
        </div>
        <footer class="cpub-admin-layouts-conflict-footer">
          <button
            ref="primaryBtn"
            type="button"
            class="cpub-admin-layouts-conflict-btn cpub-admin-layouts-conflict-btn--primary"
            @click="emit('refresh')"
          >
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Reload their version</span>
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-conflict-btn"
            @click="emit('close')"
          >
            <i class="fa-solid fa-pause"></i>
            <span>Keep editing here</span>
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-conflict-btn cpub-admin-layouts-conflict-btn--danger"
            @click="emit('force-save')"
          >
            <i class="fa-solid fa-arrow-up-from-bracket"></i>
            <span>Overwrite their changes</span>
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-admin-layouts-conflict-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-overlay, rgba(0, 0, 0, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.cpub-admin-layouts-conflict-modal {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.cpub-admin-layouts-conflict-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border2);
}
.cpub-admin-layouts-conflict-icon {
  font-size: var(--text-xl);
  color: var(--red);
}
.cpub-admin-layouts-conflict-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.cpub-admin-layouts-conflict-body {
  padding: var(--space-4);
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-admin-layouts-conflict-body-hint {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
}
.cpub-admin-layouts-conflict-body p { margin: 0; }

.cpub-admin-layouts-conflict-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--border2);
  justify-content: flex-end;
  flex-wrap: wrap;
}

.cpub-admin-layouts-conflict-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
}
.cpub-admin-layouts-conflict-btn:hover { background: var(--surface2); }
.cpub-admin-layouts-conflict-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-admin-layouts-conflict-btn--primary {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}
.cpub-admin-layouts-conflict-btn--primary:hover {
  background: var(--accent);
  filter: brightness(1.1);
  color: var(--surface);
}
.cpub-admin-layouts-conflict-btn--danger {
  color: var(--red);
  border-color: var(--red);
}
.cpub-admin-layouts-conflict-btn--danger:hover { background: var(--red); color: var(--surface); }
</style>
