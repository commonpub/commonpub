import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Dialog from '../Dialog.vue';

describe('Dialog', () => {
  it('does not render content when closed', () => {
    render(Dialog, {
      props: { open: false },
      slots: { default: 'Dialog content' },
    });
    expect(screen.queryByText('Dialog content')).toBeNull();
  });

  it('renders content when open', () => {
    render(Dialog, {
      props: { open: true },
      slots: { default: 'Dialog content' },
    });
    expect(screen.getByText('Dialog content')).toBeTruthy();
  });

  it('renders title when provided', () => {
    render(Dialog, {
      props: { open: true, title: 'My Dialog' },
      slots: { default: 'Content' },
    });
    expect(screen.getByText('My Dialog')).toBeTruthy();
  });

  it('has role="dialog" and aria-modal', () => {
    render(Dialog, {
      props: { open: true },
      slots: { default: 'Content' },
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('has aria-label matching title', () => {
    render(Dialog, {
      props: { open: true, title: 'Confirm' },
      slots: { default: 'Content' },
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Confirm');
  });

  it('emits update:open false when close button clicked', async () => {
    const { emitted } = render(Dialog, {
      props: { open: true, title: 'Test' },
      slots: { default: 'Content' },
    });
    const closeBtn = screen.getByLabelText('Close dialog');
    await fireEvent.click(closeBtn);
    expect(emitted()['update:open']).toEqual([[false]]);
  });

  it('emits update:open false when backdrop clicked', async () => {
    const { emitted } = render(Dialog, {
      props: { open: true },
      slots: { default: 'Content' },
    });
    // The backdrop is the outer div wrapping the dialog
    const backdrop = document.querySelector('.cpub-dialog-backdrop');
    expect(backdrop).toBeTruthy();
    // Clicking the backdrop itself (not the dialog)
    await fireEvent.click(backdrop!);
    expect(emitted()['update:open']).toEqual([[false]]);
  });

  it('has close button accessible', () => {
    render(Dialog, {
      props: { open: true, title: 'Test' },
      slots: { default: 'Content' },
    });
    const closeBtn = screen.getByLabelText('Close dialog');
    expect(closeBtn).toBeTruthy();
  });
});
