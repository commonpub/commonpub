import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import VisuallyHidden from '../VisuallyHidden.vue';

describe('VisuallyHidden', () => {
  it('renders slot content', () => {
    render(VisuallyHidden, {
      slots: { default: 'Hidden label text' },
    });
    expect(screen.getByText('Hidden label text')).toBeTruthy();
  });

  it('has the cpub-visually-hidden class', () => {
    render(VisuallyHidden, {
      slots: { default: 'SR only' },
    });
    const el = screen.getByText('SR only');
    expect(el.classList.contains('cpub-visually-hidden')).toBe(true);
  });

  it('renders as a span element', () => {
    render(VisuallyHidden, {
      slots: { default: 'Test' },
    });
    const el = screen.getByText('Test');
    expect(el.tagName).toBe('SPAN');
  });
});
