import type { Ref } from 'vue';

/**
 * Modal a11y helper: focus trap, initial focus, focus restoration, body
 * scroll lock. Mirrors the behaviour of `<Dialog>` in @commonpub/ui without
 * forcing a visual refactor of layer-side modals that have their own
 * header/footer styling.
 *
 * Wire it from a modal's `<script setup>`:
 *
 *   const dialogRef = ref<HTMLElement | null>(null);
 *   useFocusTrap(dialogRef, () => props.open, close);
 *
 * Where `() => props.open` is a getter that returns true while the modal
 * is visible, and `close` is the function that dismisses it (called when
 * the user presses Escape).
 *
 * The trap cycles Tab/Shift+Tab within `dialogRef`'s focusable
 * descendants. On open, focus moves to the first focusable element. On
 * close, focus restores to whatever element had focus when the modal
 * opened. Body scroll is locked while open.
 */
export function useFocusTrap(
  dialogRef: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  onEscape: () => void,
): void {
  let previousActive: HTMLElement | null = null;

  function focusableElements(): HTMLElement[] {
    if (!dialogRef.value) return [];
    return Array.from(
      dialogRef.value.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !dialogRef.value?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !dialogRef.value?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  watch(isOpen, async (open) => {
    if (open) {
      previousActive = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeydown);
      await nextTick();
      const first = focusableElements()[0];
      first?.focus();
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeydown);
      previousActive?.focus();
      previousActive = null;
    }
  });

  onUnmounted(() => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleKeydown);
  });
}
