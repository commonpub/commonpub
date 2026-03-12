import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import IconButton from '../IconButton.vue';

describe('IconButton', () => {
  it('renders with aria-label', () => {
    render(IconButton, {
      props: { label: 'Close dialog' },
      slots: { default: 'X' },
    });
    const btn = screen.getByRole('button', { name: 'Close dialog' });
    expect(btn).toBeTruthy();
  });

  it('applies secondary variant class by default', () => {
    render(IconButton, {
      props: { label: 'Action' },
      slots: { default: 'X' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-icon-btn--secondary')).toBe(true);
  });

  it('applies primary variant class', () => {
    render(IconButton, {
      props: { label: 'Action', variant: 'primary' },
      slots: { default: 'X' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-icon-btn--primary')).toBe(true);
  });

  it('applies ghost variant class', () => {
    render(IconButton, {
      props: { label: 'Action', variant: 'ghost' },
      slots: { default: 'X' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-icon-btn--ghost')).toBe(true);
  });

  it('applies size classes', () => {
    const { unmount } = render(IconButton, {
      props: { label: 'Action', size: 'sm' },
      slots: { default: 'X' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-icon-btn--sm')).toBe(true);
    unmount();

    render(IconButton, {
      props: { label: 'Action', size: 'lg' },
      slots: { default: 'X' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-icon-btn--lg')).toBe(true);
  });

  it('is disabled when disabled attr is passed', () => {
    render(IconButton, {
      props: { label: 'Action' },
      attrs: { disabled: true },
      slots: { default: 'X' },
    });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('has correct base class', () => {
    render(IconButton, {
      props: { label: 'Action' },
      slots: { default: 'X' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-icon-btn')).toBe(true);
  });
});
