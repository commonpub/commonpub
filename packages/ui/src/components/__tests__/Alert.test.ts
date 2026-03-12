import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Alert from '../Alert.vue';

describe('Alert', () => {
  it('has role="alert"', () => {
    render(Alert, {
      slots: { default: 'Warning message' },
    });
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders slot content', () => {
    render(Alert, {
      slots: { default: 'Something went wrong' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('applies info variant class by default', () => {
    render(Alert, {
      slots: { default: 'Info' },
    });
    const el = screen.getByRole('alert');
    expect(el.classList.contains('cpub-alert--info')).toBe(true);
  });

  it('applies warning variant class', () => {
    render(Alert, {
      props: { variant: 'warning' },
      slots: { default: 'Warning' },
    });
    expect(screen.getByRole('alert').classList.contains('cpub-alert--warning')).toBe(true);
  });

  it('applies danger variant class', () => {
    render(Alert, {
      props: { variant: 'danger' },
      slots: { default: 'Error' },
    });
    expect(screen.getByRole('alert').classList.contains('cpub-alert--danger')).toBe(true);
  });

  it('applies tip variant class', () => {
    render(Alert, {
      props: { variant: 'tip' },
      slots: { default: 'Tip' },
    });
    expect(screen.getByRole('alert').classList.contains('cpub-alert--tip')).toBe(true);
  });

  it('has cpub-alert base class', () => {
    render(Alert, {
      slots: { default: 'Test' },
    });
    expect(screen.getByRole('alert').classList.contains('cpub-alert')).toBe(true);
  });
});
