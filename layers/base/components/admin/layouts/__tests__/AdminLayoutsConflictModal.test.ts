/**
 * Tests for AdminLayoutsConflictModal — the 409 resolution dialog.
 *
 * Audit-polish coverage (session 160 god-mode audit). The modal's
 * three-option behavior + focus management is the load-bearing UX
 * choice from the audit; these tests lock it.
 *
 * Three options:
 *   1. "Reload their version" — primary, default-focused safe action
 *   2. "Keep editing here" — neutral middle (close)
 *   3. "Overwrite their changes" — destructive (force-save)
 *
 * Per WCAG alertdialog pattern: initial focus on the recommended
 * action; Esc dismisses.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { nextTick } from 'vue';
import AdminLayoutsConflictModal from '../AdminLayoutsConflictModal.vue';

function mount(props: { open: boolean; message?: string | null } = { open: true }) {
  return render(AdminLayoutsConflictModal, {
    props: {
      open: props.open,
      message: props.message ?? null,
    },
  });
}

describe('AdminLayoutsConflictModal — visibility', () => {
  it('renders nothing when :open=false', () => {
    const { container } = mount({ open: false });
    expect(container.querySelector('.cpub-admin-layouts-conflict-backdrop')).toBeNull();
  });

  it('renders the dialog when :open=true', () => {
    mount({ open: true });
    // Teleported to body, not the test container
    expect(document.querySelector('.cpub-admin-layouts-conflict-modal')).not.toBeNull();
  });
});

describe('AdminLayoutsConflictModal — three-option model', () => {
  it('renders exactly three action buttons', () => {
    mount({ open: true });
    const btns = document.querySelectorAll('.cpub-admin-layouts-conflict-btn');
    expect(btns.length).toBe(3);
  });

  it('first button is "Reload their version" with primary styling', () => {
    mount({ open: true });
    const btns = document.querySelectorAll('.cpub-admin-layouts-conflict-btn');
    expect(btns[0]?.textContent?.toLowerCase()).toContain('reload');
    expect(btns[0]?.classList.contains('cpub-admin-layouts-conflict-btn--primary')).toBe(true);
  });

  it('middle button is "Keep editing here" with neutral styling', () => {
    mount({ open: true });
    const btns = document.querySelectorAll('.cpub-admin-layouts-conflict-btn');
    expect(btns[1]?.textContent?.toLowerCase()).toContain('keep editing');
    expect(btns[1]?.classList.contains('cpub-admin-layouts-conflict-btn--primary')).toBe(false);
    expect(btns[1]?.classList.contains('cpub-admin-layouts-conflict-btn--danger')).toBe(false);
  });

  it('last button is "Overwrite their changes" with destructive styling', () => {
    mount({ open: true });
    const btns = document.querySelectorAll('.cpub-admin-layouts-conflict-btn');
    expect(btns[2]?.textContent?.toLowerCase()).toContain('overwrite');
    expect(btns[2]?.classList.contains('cpub-admin-layouts-conflict-btn--danger')).toBe(true);
  });

  it('does NOT use "Force save" terminology (audit anti-pattern)', () => {
    mount({ open: true });
    expect(document.body.textContent?.toLowerCase()).not.toContain('force save');
  });
});

describe('AdminLayoutsConflictModal — message + heading', () => {
  it('renders the audit-renamed "Version conflict" heading', () => {
    mount({ open: true });
    const heading = document.querySelector('.cpub-admin-layouts-conflict-title');
    expect(heading?.textContent).toContain('Version conflict');
  });

  it('renders custom message when provided', () => {
    mount({ open: true, message: 'Alice just published this.' });
    expect(document.body.textContent).toContain('Alice just published');
  });

  it('renders default message when none provided', () => {
    mount({ open: true });
    expect(document.body.textContent?.toLowerCase()).toContain('another admin saved');
  });
});

describe('AdminLayoutsConflictModal — accessibility', () => {
  it('uses role=alertdialog with labelledby + describedby', () => {
    mount({ open: true });
    const modal = document.querySelector('.cpub-admin-layouts-conflict-modal');
    expect(modal?.getAttribute('role')).toBe('alertdialog');
    expect(modal?.getAttribute('aria-labelledby')).toBe('cpub-admin-layouts-conflict-title');
    expect(modal?.getAttribute('aria-describedby')).toBe('cpub-admin-layouts-conflict-body');
  });

  it('focuses the primary "Reload" button on open', async () => {
    mount({ open: true });
    await nextTick();
    await nextTick(); // watch is async + setTimeout-free, give it one extra tick
    const primary = document.querySelector('.cpub-admin-layouts-conflict-btn--primary');
    // jsdom + nextTick is racy for focus assertions; allow the
    // active element OR the primary button being the same target.
    expect(document.activeElement).toBe(primary);
  });
});

describe('AdminLayoutsConflictModal — emit contract', () => {
  it('emits "refresh" when primary button is clicked', async () => {
    const { emitted } = mount({ open: true });
    const primary = document.querySelector('.cpub-admin-layouts-conflict-btn--primary') as HTMLButtonElement;
    primary.click();
    await nextTick();
    expect(emitted().refresh).toBeTruthy();
  });

  it('emits "close" when middle button is clicked', async () => {
    const { emitted } = mount({ open: true });
    const btns = document.querySelectorAll('.cpub-admin-layouts-conflict-btn');
    (btns[1] as HTMLButtonElement).click();
    await nextTick();
    expect(emitted().close).toBeTruthy();
  });

  it('emits "force-save" when destructive button is clicked', async () => {
    const { emitted } = mount({ open: true });
    const destructive = document.querySelector('.cpub-admin-layouts-conflict-btn--danger') as HTMLButtonElement;
    destructive.click();
    await nextTick();
    expect(emitted()['force-save']).toBeTruthy();
  });

  it('emits "close" when Escape is pressed', async () => {
    const { emitted } = mount({ open: true });
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(emitted().close).toBeTruthy();
  });

  it('does NOT emit "close" on Escape when the modal is closed', async () => {
    const { emitted } = mount({ open: false });
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(emitted().close).toBeFalsy();
  });
});

describe('AdminLayoutsConflictModal — focus trap (session 165 round 5)', () => {
  it('focus moved outside the dialog while open snaps back to the primary button', async () => {
    mount({ open: true });
    await new Promise((r) => setTimeout(r, 0));

    // Sanity: primary button has initial focus (matches the watcher).
    const primary = document.querySelector<HTMLButtonElement>(
      '.cpub-admin-layouts-conflict-btn--primary',
    );
    expect(document.activeElement).toBe(primary);

    // Move focus to an element OUTSIDE the dialog.
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    await new Promise((r) => setTimeout(r, 0));

    // Trap kicks in: focus snaps back to the safe primary action.
    expect(document.activeElement).toBe(primary);

    document.body.removeChild(outside);
  });

  it('Tab walks among the three buttons WITHOUT triggering the trap (focus stays inside dialog)', async () => {
    mount({ open: true });
    await new Promise((r) => setTimeout(r, 0));

    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cpub-admin-layouts-conflict-btn'),
    );
    expect(btns.length).toBe(3);

    // Programmatically focus the middle "Keep editing" button — focusin
    // fires, contains-check returns true → no snap to primary.
    btns[1]!.focus();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(btns[1]);

    // And the destructive button — same dialog → focus allowed.
    btns[2]!.focus();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(btns[2]);
  });

  it('focus trap is inactive when :open=false', async () => {
    const { rerender } = mount({ open: true });
    await new Promise((r) => setTimeout(r, 0));
    await rerender({ open: false, message: null });
    await new Promise((r) => setTimeout(r, 0));

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.activeElement).toBe(outside);
    document.body.removeChild(outside);
  });

  it('topmost-only guard: when another later-mounted dialog is on top, this dialog yields focus to it', async () => {
    mount({ open: true });
    await new Promise((r) => setTimeout(r, 0));

    // Inject a LATER dialog into the body (simulates HelpOverlay mounted
    // after ConflictModal — DOM order puts the later one last, our
    // querySelector returns it as topmost).
    const laterDialog = document.createElement('div');
    laterDialog.setAttribute('role', 'dialog');
    const laterFocusable = document.createElement('button');
    laterFocusable.textContent = 'Later dialog button';
    laterDialog.appendChild(laterFocusable);
    document.body.appendChild(laterDialog);

    // Focus moves to a focusable in the later dialog.
    laterFocusable.focus();
    await new Promise((r) => setTimeout(r, 0));

    // ConflictModal's trap should NOT snap back — it's not topmost.
    expect(document.activeElement).toBe(laterFocusable);

    document.body.removeChild(laterDialog);
  });
});
