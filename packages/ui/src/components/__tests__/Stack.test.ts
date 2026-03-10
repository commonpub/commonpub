import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Stack from '../Stack.svelte';

describe('Stack', () => {
  it('renders as a flex container', () => {
    const { container } = render(Stack, {
      props: { children: (() => {}) as never },
    });
    const el = container.querySelector('.snaplify-stack');
    expect(el).toBeInTheDocument();
  });

  it('defaults to vertical direction', () => {
    const { container } = render(Stack, {
      props: { children: (() => {}) as never },
    });
    const el = container.querySelector('.snaplify-stack') as HTMLElement;
    expect(el.style.flexDirection).toBe('column');
  });

  it('supports horizontal direction', () => {
    const { container } = render(Stack, {
      props: { direction: 'horizontal', children: (() => {}) as never },
    });
    const el = container.querySelector('.snaplify-stack') as HTMLElement;
    expect(el.style.flexDirection).toBe('row');
  });

  it('applies custom gap', () => {
    const { container } = render(Stack, {
      props: { gap: 'var(--space-8, 2rem)', children: (() => {}) as never },
    });
    const el = container.querySelector('.snaplify-stack') as HTMLElement;
    expect(el.style.gap).toBe('var(--space-8, 2rem)');
  });

  it('accepts a class prop', () => {
    const { container } = render(Stack, {
      props: { class: 'custom', children: (() => {}) as never },
    });
    expect(container.querySelector('.snaplify-stack')?.className).toContain('custom');
  });
});
