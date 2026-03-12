import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Button from '../Button.vue';

describe('Button', () => {
  it('renders slot content', () => {
    render(Button, {
      slots: { default: 'Click me' },
    });
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies primary variant class by default', () => {
    render(Button, {
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-btn--primary')).toBe(true);
  });

  it('applies secondary variant class', () => {
    render(Button, {
      props: { variant: 'secondary' },
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-btn--secondary')).toBe(true);
  });

  it('applies danger variant class', () => {
    render(Button, {
      props: { variant: 'danger' },
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-btn--danger')).toBe(true);
  });

  it('applies ghost variant class', () => {
    render(Button, {
      props: { variant: 'ghost' },
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('cpub-btn--ghost')).toBe(true);
  });

  it('applies size classes', () => {
    const { unmount } = render(Button, {
      props: { size: 'sm' },
      slots: { default: 'Test' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-btn--sm')).toBe(true);
    unmount();

    render(Button, {
      props: { size: 'lg' },
      slots: { default: 'Test' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-btn--lg')).toBe(true);
  });

  it('is disabled when disabled prop is true', () => {
    render(Button, {
      props: { disabled: true },
      slots: { default: 'Test' },
    });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when loading is true', () => {
    render(Button, {
      props: { loading: true },
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('shows spinner when loading', () => {
    render(Button, {
      props: { loading: true },
      slots: { default: 'Test' },
    });
    const btn = screen.getByRole('button');
    const spinner = btn.querySelector('.cpub-btn__spinner');
    expect(spinner).not.toBeNull();
  });

  it('has correct base class', () => {
    render(Button, {
      slots: { default: 'Test' },
    });
    expect(screen.getByRole('button').classList.contains('cpub-btn')).toBe(true);
  });

  it('is accessible as a button', () => {
    render(Button, {
      slots: { default: 'Submit form' },
    });
    const btn = screen.getByRole('button', { name: 'Submit form' });
    expect(btn).toBeTruthy();
  });
});
