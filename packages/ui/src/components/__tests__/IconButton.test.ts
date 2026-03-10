import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import IconButton from '../IconButton.svelte';

describe('IconButton', () => {
  it('renders as a button element', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Close', children: (() => {}) as never },
    });
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('requires aria-label', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Delete item', children: (() => {}) as never },
    });
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('aria-label')).toBe('Delete item');
  });

  it('renders as square (equal width and height class)', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Menu', size: 'md', children: (() => {}) as never },
    });
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('snaplify-icon-btn--md');
  });

  it('applies variant class', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Action', variant: 'primary', children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.className).toContain('snaplify-icon-btn--primary');
  });

  it('fires onclick handler', async () => {
    const handler = vi.fn();
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Click', onclick: handler, children: (() => {}) as never },
    });
    await userEvent.click(container.querySelector('button')!);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('can be disabled', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Disabled', disabled: true, children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.disabled).toBe(true);
  });

  it('accepts a class prop', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Custom', class: 'my-class', children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.className).toContain('my-class');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Accessible button', children: (() => {}) as never },
    });
    await expectNoA11yViolations(container);
  });
});
