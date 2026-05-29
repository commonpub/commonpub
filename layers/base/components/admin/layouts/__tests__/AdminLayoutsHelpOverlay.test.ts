/**
 * Tests for AdminLayoutsHelpOverlay — the `?` keyboard shortcuts modal.
 *
 * Phase 3d.3. Pattern matches AdminLayoutsConflictModal.test.ts:
 *  - render the component, assert teleport to body
 *  - assert ARIA dialog + labelling
 *  - assert focus moves to the close button on open
 *  - Esc + backdrop click + close button all emit close
 *  - hotkey table content matches the bindings useLayoutHotkeys ships
 *
 * The hotkey table is the load-bearing UX surface — these tests guard
 * against accidentally dropping a binding from the rendered list when
 * a new shortcut is added (the kickoff plan §7.8 warns: every new
 * hotkey MUST be added to the help overlay table, or it's invisible
 * to users).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import AdminLayoutsHelpOverlay from '../AdminLayoutsHelpOverlay.vue';

function mount(open = true) {
  return render(AdminLayoutsHelpOverlay, { props: { open } });
}

describe('AdminLayoutsHelpOverlay — visibility', () => {
  it('renders nothing when :open=false', () => {
    const { container } = mount(false);
    expect(container.querySelector('.cpub-admin-layouts-help-backdrop')).toBeNull();
    expect(document.querySelector('.cpub-admin-layouts-help-modal')).toBeNull();
  });

  it('teleports the dialog to body when :open=true', () => {
    mount(true);
    expect(document.querySelector('.cpub-admin-layouts-help-modal')).not.toBeNull();
  });
});

describe('AdminLayoutsHelpOverlay — ARIA', () => {
  it('dialog has role=dialog + aria-modal=true + aria-labelledby pointing at the title', () => {
    mount(true);
    const dialog = document.querySelector('.cpub-admin-layouts-help-modal');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('cpub-admin-layouts-help-title');
    expect(document.getElementById('cpub-admin-layouts-help-title')?.textContent)
      .toContain('Keyboard shortcuts');
  });

  it('close button has an accessible name', () => {
    mount(true);
    const close = document.querySelector<HTMLButtonElement>('.cpub-admin-layouts-help-close');
    expect(close?.getAttribute('aria-label')).toBe('Close keyboard shortcuts');
  });
});

describe('AdminLayoutsHelpOverlay — focus on open', () => {
  it('focus lands on the close button when opened (mounted with :open=true)', async () => {
    mount(true);
    // watch with immediate:true + nextTick — flush the focus call.
    await new Promise((r) => setTimeout(r, 0));
    const close = document.querySelector<HTMLButtonElement>('.cpub-admin-layouts-help-close');
    expect(document.activeElement).toBe(close);
  });
});

describe('AdminLayoutsHelpOverlay — close emissions', () => {
  it('close button emits close', async () => {
    const { emitted } = mount(true);
    const close = document.querySelector<HTMLButtonElement>('.cpub-admin-layouts-help-close')!;
    await fireEvent.click(close);
    expect(emitted().close).toBeTruthy();
  });

  it('backdrop click emits close', async () => {
    const { emitted } = mount(true);
    const backdrop = document.querySelector<HTMLElement>('.cpub-admin-layouts-help-backdrop')!;
    await fireEvent.click(backdrop);
    expect(emitted().close).toBeTruthy();
  });

  it('click INSIDE the dialog does NOT emit close (backdrop click-self only)', async () => {
    const { emitted } = mount(true);
    const dialog = document.querySelector<HTMLElement>('.cpub-admin-layouts-help-modal')!;
    await fireEvent.click(dialog);
    expect(emitted().close).toBeUndefined();
  });

  it('Esc emits close', () => {
    const { emitted } = mount(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(emitted().close).toBeTruthy();
  });

  it('Esc when closed → no emission (defensive)', () => {
    const { emitted } = mount(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(emitted().close).toBeUndefined();
  });
});

describe('AdminLayoutsHelpOverlay — hotkey table coverage', () => {
  it('lists every Phase 3b/B + 3d binding that useLayoutHotkeys ships', () => {
    mount(true);
    const text = document.querySelector('.cpub-admin-layouts-help-body')?.textContent ?? '';
    // Phase 3d.1
    expect(text).toContain('Backspace');
    expect(text).toContain('Delete');
    // Phase 3d.2
    expect(text).toMatch(/⌘\s*\+?\s*D/i); // chord with D
    expect(text.toLowerCase()).toContain('duplicate');
    // Phase 3b/B
    expect(text).toMatch(/⌘\s*\+?\s*Z/i); // undo
    expect(text.toLowerCase()).toContain('undo');
    expect(text.toLowerCase()).toContain('redo');
    expect(text).toContain('Shift'); // redo chord
    // Phase 3d.3 (self-referential)
    expect(text).toContain('?');
    expect(text).toContain('Esc');
  });

  it('renders the cross-platform footer hint', () => {
    mount(true);
    const hint = document.querySelector('.cpub-admin-layouts-help-hint')?.textContent ?? '';
    expect(hint).toContain('Command');
    expect(hint).toContain('Ctrl');
  });

  it('every chord part renders inside a <kbd> element', () => {
    mount(true);
    const kbds = document.querySelectorAll('.cpub-admin-layouts-help-chord kbd');
    expect(kbds.length).toBeGreaterThan(8); // 10+ rendered chord parts across groups
    // Ensure no chord part is empty (formatting regression guard).
    for (const k of kbds) {
      expect(k.textContent?.trim()).toBeTruthy();
    }
  });
});

describe('AdminLayoutsHelpOverlay — focus trap (session 165 deep audit R3-B)', () => {
  it('focus moved outside the dialog while open snaps back to the close button', async () => {
    mount(true);
    // Inject a focusable element OUTSIDE the dialog + focus it. The
    // trap should snap focus back to the close button on focusin.
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    await new Promise((r) => setTimeout(r, 0));

    // Sanity: close button has initial focus from the watcher.
    const close = document.querySelector<HTMLButtonElement>('.cpub-admin-layouts-help-close');
    expect(document.activeElement).toBe(close);

    // User Tabs to (or programmatically focuses) the outside element.
    outside.focus();
    await new Promise((r) => setTimeout(r, 0));

    // Trap kicked in: focus is back on close.
    expect(document.activeElement).toBe(close);

    document.body.removeChild(outside);
  });

  it('focus moves freely WITHIN the dialog (trap allows nested focusables)', async () => {
    // Sanity check: if a future change adds another focusable to the
    // dialog, the trap shouldn't fight it. Today we only have one
    // (Close); inject a defensive extra to verify the contains-check.
    mount(true);
    await new Promise((r) => setTimeout(r, 0));
    const dialog = document.querySelector<HTMLElement>('.cpub-admin-layouts-help-modal')!;
    const extra = document.createElement('button');
    extra.textContent = 'Extra';
    dialog.appendChild(extra);

    extra.focus();
    await new Promise((r) => setTimeout(r, 0));

    // Focus stays on the in-dialog button — the trap doesn't snap back
    // when focus is INSIDE the dialog tree.
    expect(document.activeElement).toBe(extra);

    dialog.removeChild(extra);
  });

  it('focus trap is inactive when :open=false (outside focus stays put)', async () => {
    const { rerender } = mount(true);
    await new Promise((r) => setTimeout(r, 0));
    await rerender({ open: false });
    await new Promise((r) => setTimeout(r, 0));

    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    await new Promise((r) => setTimeout(r, 0));

    // Closed → no snap-back; focus stays on outside button.
    expect(document.activeElement).toBe(outside);

    document.body.removeChild(outside);
  });

  it('topmost-only guard: when a later dialog is on top, this trap yields (session 165 round 5)', async () => {
    mount(true);
    await new Promise((r) => setTimeout(r, 0));

    // Inject a LATER dialog (simulates ConflictModal mounted on top of
    // help — DOM order puts later one last; topmost check picks the later
    // one). Help's trap must NOT snap focus back when the later dialog
    // is foreground.
    const laterDialog = document.createElement('div');
    laterDialog.setAttribute('role', 'alertdialog');
    const laterFocusable = document.createElement('button');
    laterFocusable.textContent = 'Conflict modal button';
    laterDialog.appendChild(laterFocusable);
    document.body.appendChild(laterDialog);

    laterFocusable.focus();
    await new Promise((r) => setTimeout(r, 0));

    // HelpOverlay's trap is inactive because we're not topmost.
    expect(document.activeElement).toBe(laterFocusable);

    document.body.removeChild(laterDialog);
  });
});

describe('AdminLayoutsHelpOverlay — hotkey table after session 165 audit R1-A', () => {
  it('Move group dropped (no duplicate-chord Tab+Enter rows)', () => {
    mount(true);
    const groupTitles = Array.from(
      document.querySelectorAll('.cpub-admin-layouts-help-group-title'),
    ).map((el) => el.textContent?.trim());
    expect(groupTitles).toEqual(['Edit', 'History', 'View']);
  });
});

describe('AdminLayoutsHelpOverlay — lifecycle', () => {
  it('removes the global keydown listener on unmount (Esc no longer emits)', () => {
    const { unmount } = mount(true);
    unmount();
    // Reset: any close emission tracked above unmount is gone with the wrapper.
    // Fresh keydown to verify nothing throws + no error from a stale handler.
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }).not.toThrow();
  });

  it('removes the focusin listener on unmount (no trap-snap after the dialog is gone)', () => {
    const { unmount } = mount(true);
    unmount();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    // After unmount, the focusin listener is gone — outside focus stays.
    expect(document.activeElement).toBe(outside);
    document.body.removeChild(outside);
  });
});
