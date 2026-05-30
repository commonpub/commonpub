<script setup lang="ts">
/**
 * Help overlay — keyboard shortcut reference modal. Phase 3d.3 +
 * session 165 deep audit R3-B (focus trap).
 *
 * Opens on `?` (Shift+/) per the convention Linear / GitHub / Notion
 * / Figma all share. Read-only: lists every keyboard shortcut grouped
 * by category. Close via Esc, backdrop click, or the Close button.
 *
 * Focus trap: when focus leaves the dialog while it's open, snap it
 * back to the Close button. Implemented via a `focusin` listener on
 * document. The check `dialog.contains(target)` allows focus to move
 * freely WITHIN the dialog (future-proof: works even if more
 * focusables are added later) but rejects focus outside. Closes WCAG
 * ARIA Dialog pattern (focus shouldn't escape an open modal).
 *
 * Cross-platform key rendering: shows ⌘ (Cmd) for the META modifier in
 * each chord. Mac users see "⌘ Z"; the visible glyph is the same
 * keyboard pictograph their OS uses everywhere. Windows/Linux users
 * read "⌘ Z" and pattern-match to Ctrl — every cross-platform editor
 * (Notion / VS Code / Linear) uses this convention rather than
 * runtime-sniffing the platform (which is brittle on iPad with a
 * Magic Keyboard, on Linux desktops claiming to be a Mac, etc).
 */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  /** Show/hide the modal. The parent (the editor page) owns this
   *  ref + flips it on `?` keypress. */
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

/* ------------------------------------------------------------------ */
/* Hotkey table — single source of truth for the rendered chords.    */
/* If a new binding is added to useLayoutHotkeys, ADD A ROW HERE too. */
/* ------------------------------------------------------------------ */
interface Hotkey {
  /** The chord, rendered as one or more `<kbd>` elements joined with
   *  a `+` separator at view-time. */
  chord: string[];
  /** Short prose description. Plain English, no jargon. */
  description: string;
}
interface HotkeyGroup {
  title: string;
  rows: Hotkey[];
}

const groups: HotkeyGroup[] = [
  {
    title: 'Edit',
    rows: [
      { chord: ['Backspace'], description: 'Remove the selected section. Press Command+Z to restore.' },
      { chord: ['Delete'], description: 'Remove the selected section (alias for Backspace).' },
      { chord: ['⌘', 'D'], description: 'Duplicate the selected section. Selection moves to the new copy.' },
      { chord: ['Shift', '←'], description: 'Shrink the selected section by 1 column. Right neighbour absorbs the gap; stops at the section’s minimum.' },
      { chord: ['Shift', '→'], description: 'Grow the selected section by 1 column. Right neighbour shrinks; stops at its minimum.' },
    ],
  },
  {
    title: 'History',
    rows: [
      { chord: ['⌘', 'Z'], description: 'Undo the last change. Stack holds the most recent 50 operations.' },
      { chord: ['⌘', 'Shift', 'Z'], description: 'Redo. Cancelled by any new action — Notion/Linear convention.' },
    ],
  },
  // (Move group deliberately omitted — session 165 deep audit R1-A.
  // Move Up / Move Down / Move-to-zone are visible buttons in the
  // section's top-right cluster, discoverable via Tab. They're not
  // hidden keyboard shortcuts; listing them here as "Tab + Enter"
  // chord rows was misleading — the chord didn't disambiguate the
  // three different button targets.)
  {
    title: 'View',
    rows: [
      { chord: ['?'], description: 'Show this overlay.' },
      { chord: ['Esc'], description: 'Close this overlay; close popovers; clear selection.' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Focus on close button at open-time (matches conflict modal).        */
/* ------------------------------------------------------------------ */
const closeBtn = ref<HTMLButtonElement | null>(null);
const dialogEl = ref<HTMLElement | null>(null);
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      closeBtn.value?.focus();
    }
  },
  { immediate: true },
);

/* Esc closes — global keydown so backdrop focus (or accidental loss
 * of focus to <body>) still dismisses. The :open guard makes this a
 * no-op when closed. */
function onKeydown(e: KeyboardEvent): void {
  if (props.open && e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

/* Focus trap (session 165 deep audit R3-B). When the modal is open and
 * focus moves to an element OUTSIDE the dialog (Tab past the close
 * button, programmatic focus from underlying page, etc), snap focus
 * back to the close button. The `dialog.contains(target)` check
 * future-proofs the trap: any new focusable inside the dialog is
 * naturally allowed.
 *
 * Why focusin (vs keydown Tab): catches BOTH Tab and programmatic
 * focus changes, including ones the editor page might trigger via
 * other composables. The check fires AFTER focus has moved, so the
 * snap-back is observable (a tiny focus blip on the outside element),
 * but it's the most robust approach in jsdom + browsers.
 *
 * Topmost-only guard (session 165 round 5): if a later-mounted dialog
 * is on top of us, let THAT dialog's trap own focus. Without this guard
 * two simultaneously-open modals' traps would ping-pong focus. Parent
 * coordination in [id].vue closes us when ConflictModal opens, so this
 * guard is belt-and-suspenders — necessary only for the brief window
 * where both are mounted before the watcher fires. */
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
  closeBtn.value?.focus();
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
      class="cpub-admin-layouts-help-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <div
        ref="dialogEl"
        class="cpub-admin-layouts-help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cpub-admin-layouts-help-title"
      >
        <header class="cpub-admin-layouts-help-header">
          <h2 id="cpub-admin-layouts-help-title" class="cpub-admin-layouts-help-title">
            Keyboard shortcuts
          </h2>
          <button
            ref="closeBtn"
            type="button"
            class="cpub-admin-layouts-help-close"
            aria-label="Close keyboard shortcuts"
            @click="emit('close')"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <div class="cpub-admin-layouts-help-body">
          <section
            v-for="group in groups"
            :key="group.title"
            class="cpub-admin-layouts-help-group"
          >
            <h3 class="cpub-admin-layouts-help-group-title">{{ group.title }}</h3>
            <dl class="cpub-admin-layouts-help-list">
              <template v-for="row in group.rows" :key="row.description">
                <dt class="cpub-admin-layouts-help-chord">
                  <template v-for="(part, i) in row.chord" :key="i">
                    <kbd>{{ part }}</kbd>
                    <span v-if="i < row.chord.length - 1" class="cpub-admin-layouts-help-plus" aria-hidden="true">+</span>
                  </template>
                </dt>
                <dd class="cpub-admin-layouts-help-desc">{{ row.description }}</dd>
              </template>
            </dl>
          </section>
        </div>
        <footer class="cpub-admin-layouts-help-footer">
          <p class="cpub-admin-layouts-help-hint">
            ⌘ stands for the Command key on macOS and the Ctrl key on Windows/Linux.
          </p>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-admin-layouts-help-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-overlay, rgba(0, 0, 0, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.cpub-admin-layouts-help-modal {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.cpub-admin-layouts-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border2);
}
.cpub-admin-layouts-help-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
}
.cpub-admin-layouts-help-close {
  /* 28×28 touch target — matches the section-move buttons + edge-tab
     buttons elsewhere in the editor (WCAG 2.5.8 AA = 24×24 floor). */
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text-dim);
  cursor: pointer;
  font-size: var(--text-sm);
}
.cpub-admin-layouts-help-close:hover { background: var(--surface2); color: var(--text); }
.cpub-admin-layouts-help-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-admin-layouts-help-body {
  padding: var(--space-4);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-admin-layouts-help-group-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
  margin: 0 0 var(--space-2) 0;
  border-bottom: 1px solid var(--border2);
  padding-bottom: var(--space-1);
}

.cpub-admin-layouts-help-list {
  display: grid;
  grid-template-columns: minmax(120px, max-content) 1fr;
  column-gap: var(--space-4);
  row-gap: var(--space-2);
  margin: 0;
}

.cpub-admin-layouts-help-chord {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
}
.cpub-admin-layouts-help-chord kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  padding: 0 var(--space-1);
  height: 1.6em;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: none;
  letter-spacing: 0;
}
.cpub-admin-layouts-help-plus {
  color: var(--text-faint);
  font-size: var(--text-xs);
}

.cpub-admin-layouts-help-desc {
  margin: 0;
  color: var(--text);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.cpub-admin-layouts-help-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border2);
}
.cpub-admin-layouts-help-hint {
  font-size: var(--text-xs);
  color: var(--text-dim);
  margin: 0;
}
</style>
