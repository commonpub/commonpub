import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import ProgressBar from '../ProgressBar.vue';

describe('ProgressBar', () => {
  it('has role="progressbar"', () => {
    render(ProgressBar, {
      props: { value: 50 },
    });
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('sets aria-valuenow to the current value', () => {
    render(ProgressBar, {
      props: { value: 42 },
    });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
  });

  it('sets aria-valuemin to 0', () => {
    render(ProgressBar, {
      props: { value: 50 },
    });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemin')).toBe('0');
  });

  it('sets aria-valuemax to 100 by default', () => {
    render(ProgressBar, {
      props: { value: 50 },
    });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('100');
  });

  it('sets aria-valuemax to custom max', () => {
    render(ProgressBar, {
      props: { value: 5, max: 10 },
    });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('10');
  });

  it('renders fill bar with correct width percentage', () => {
    render(ProgressBar, {
      props: { value: 75 },
    });
    const fill = screen.getByRole('progressbar').querySelector('.cpub-progress__fill') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });

  it('clamps value to max', () => {
    render(ProgressBar, {
      props: { value: 150, max: 100 },
    });
    const fill = screen.getByRole('progressbar').querySelector('.cpub-progress__fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('applies variant class', () => {
    render(ProgressBar, {
      props: { value: 50, variant: 'green' },
    });
    const fill = screen.getByRole('progressbar').querySelector('.cpub-progress__fill');
    expect(fill?.classList.contains('cpub-progress__fill--green')).toBe(true);
  });

  it('has cpub-progress base class', () => {
    render(ProgressBar, {
      props: { value: 50 },
    });
    expect(screen.getByRole('progressbar').classList.contains('cpub-progress')).toBe(true);
  });
});
