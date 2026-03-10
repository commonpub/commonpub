import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Button from '../Button.svelte';

/** Helper to render Button with text content via a wrapper */
function renderButton(props: Record<string, unknown> = {}) {
  return render(Button, { props: { children: textSnippet('Click me'), ...props } });
}

/** Create a simple text snippet for testing */
function textSnippet(text: string) {
  return ((_: HTMLElement) => {
    // Svelte snippet rendering - testing-library handles this
  }) as never;
}

// Since Svelte 5 snippets are hard to pass in tests, we'll test via a wrapper component.
// For now, test the component attributes and behavior directly.

describe('Button', () => {
  it('renders as a button element', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never },
    });
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('defaults to type=button', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });

  it('accepts type=submit', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, type: 'submit' },
    });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('submit');
  });

  it('applies variant class', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, variant: 'danger' },
    });
    expect(container.querySelector('button')?.className).toContain('snaplify-btn--danger');
  });

  it('applies size class', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, size: 'lg' },
    });
    expect(container.querySelector('button')?.className).toContain('snaplify-btn--lg');
  });

  it('is disabled when disabled prop is true', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, disabled: true },
    });
    const btn = container.querySelector('button');
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute('aria-disabled')).toBe('true');
  });

  it('is disabled and shows spinner when loading', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, loading: true },
    });
    const btn = container.querySelector('button');
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.snaplify-btn__spinner')).toBeTruthy();
  });

  it('fires onclick handler', async () => {
    const handler = vi.fn();
    const { container } = render(Button, {
      props: { children: (() => {}) as never, onclick: handler },
    });
    const btn = container.querySelector('button')!;
    await userEvent.click(btn);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not fire onclick when disabled', async () => {
    const handler = vi.fn();
    const { container } = render(Button, {
      props: { children: (() => {}) as never, onclick: handler, disabled: true },
    });
    const btn = container.querySelector('button')!;
    await userEvent.click(btn);
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts a class prop', () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never, class: 'custom-class' },
    });
    expect(container.querySelector('button')?.className).toContain('custom-class');
  });

  it('is keyboard accessible', async () => {
    const handler = vi.fn();
    const { container } = render(Button, {
      props: { children: (() => {}) as never, onclick: handler },
    });
    const btn = container.querySelector('button')!;
    btn.focus();
    await userEvent.keyboard('{Enter}');
    expect(handler).toHaveBeenCalled();
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Button, {
      props: { children: (() => {}) as never },
    });
    // Add text content for axe (snippets don't render in test)
    container.querySelector('button')!.textContent = 'Submit';
    await expectNoA11yViolations(container);
  });
});
