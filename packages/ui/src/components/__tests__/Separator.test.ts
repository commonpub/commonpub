import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Separator from '../Separator.vue';

describe('Separator', () => {
  it('has role="separator"', () => {
    render(Separator);
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('defaults to horizontal orientation', () => {
    render(Separator);
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('applies horizontal class by default', () => {
    render(Separator);
    const sep = screen.getByRole('separator');
    expect(sep.classList.contains('cpub-separator--horizontal')).toBe(true);
  });

  it('applies vertical orientation', () => {
    render(Separator, {
      props: { orientation: 'vertical' },
    });
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.classList.contains('cpub-separator--vertical')).toBe(true);
  });

  it('applies dashed class when dashed prop is true', () => {
    render(Separator, {
      props: { dashed: true },
    });
    const sep = screen.getByRole('separator');
    expect(sep.classList.contains('cpub-separator--dashed')).toBe(true);
  });

  it('renders as an hr element', () => {
    render(Separator);
    const sep = screen.getByRole('separator');
    expect(sep.tagName).toBe('HR');
  });
});
