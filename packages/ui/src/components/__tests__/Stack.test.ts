import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Stack from '../Stack.vue';

describe('Stack', () => {
  it('renders children via slot', () => {
    render(Stack, {
      slots: { default: '<span>Child 1</span><span>Child 2</span>' },
    });
    expect(screen.getByText('Child 1')).toBeTruthy();
    expect(screen.getByText('Child 2')).toBeTruthy();
  });

  it('has the cpub-stack class', () => {
    render(Stack, {
      slots: { default: '<span>Item</span>' },
    });
    const el = screen.getByText('Item').parentElement;
    expect(el?.classList.contains('cpub-stack')).toBe(true);
  });

  it('defaults to column direction', () => {
    render(Stack, {
      slots: { default: '<span>Item</span>' },
    });
    const el = screen.getByText('Item').parentElement;
    expect(el?.style.flexDirection).toBe('column');
  });

  it('applies row direction when specified', () => {
    render(Stack, {
      props: { direction: 'row' },
      slots: { default: '<span>Item</span>' },
    });
    const el = screen.getByText('Item').parentElement;
    expect(el?.style.flexDirection).toBe('row');
  });

  it('applies custom gap', () => {
    render(Stack, {
      props: { gap: '2rem' },
      slots: { default: '<span>Item</span>' },
    });
    const el = screen.getByText('Item').parentElement;
    expect(el?.style.gap).toBe('2rem');
  });

  it('applies align and justify styles', () => {
    render(Stack, {
      props: { align: 'center', justify: 'space-between' },
      slots: { default: '<span>Item</span>' },
    });
    const el = screen.getByText('Item').parentElement;
    expect(el?.style.alignItems).toBe('center');
    expect(el?.style.justifyContent).toBe('space-between');
  });
});
