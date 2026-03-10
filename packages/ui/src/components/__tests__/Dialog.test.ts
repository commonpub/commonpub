import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Dialog from '../Dialog.svelte';

describe('Dialog', () => {
  it('does not render when closed', () => {
    render(Dialog, {
      props: { 'aria-label': 'Test dialog', open: false, children: (() => {}) as never },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(Dialog, {
      props: { 'aria-label': 'Test dialog', open: true, children: (() => {}) as never },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal=true', () => {
    render(Dialog, {
      props: { 'aria-label': 'Test dialog', open: true, children: (() => {}) as never },
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-label', () => {
    render(Dialog, {
      props: { 'aria-label': 'Confirm action', open: true, children: (() => {}) as never },
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Confirm action');
  });

  it('fires onclose on Escape', async () => {
    const handler = vi.fn();
    render(Dialog, {
      props: {
        'aria-label': 'Test',
        open: true,
        onclose: handler,
        children: (() => {}) as never,
      },
    });
    const dialog = screen.getByRole('dialog');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('accepts a class prop', () => {
    render(Dialog, {
      props: {
        'aria-label': 'Test',
        open: true,
        class: 'custom',
        children: (() => {}) as never,
      },
    });
    expect(screen.getByRole('dialog').className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Dialog, {
      props: {
        'aria-label': 'Accessible dialog',
        open: true,
        children: (() => {}) as never,
      },
    });
    await expectNoA11yViolations(container);
  });
});
