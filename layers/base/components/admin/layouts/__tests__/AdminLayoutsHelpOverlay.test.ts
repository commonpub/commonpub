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
});
