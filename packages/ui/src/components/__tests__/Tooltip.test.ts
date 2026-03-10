import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Tooltip from '../Tooltip.svelte';

describe('Tooltip', () => {
  it('renders trigger content', () => {
    const { container } = render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    expect(container.querySelector('.snaplify-tooltip-wrapper')).toBeInTheDocument();
  });

  it('does not show tooltip by default', () => {
    render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    const { container } = render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    await userEvent.hover(container.querySelector('.snaplify-tooltip-wrapper')!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text');
  });

  it('hides tooltip on unhover', async () => {
    const { container } = render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    const wrapper = container.querySelector('.snaplify-tooltip-wrapper')!;
    await userEvent.hover(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.unhover(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('has aria-describedby when visible', async () => {
    const { container } = render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    const wrapper = container.querySelector('.snaplify-tooltip-wrapper')!;
    expect(wrapper).not.toHaveAttribute('aria-describedby');
    await userEvent.hover(wrapper);
    expect(wrapper).toHaveAttribute('aria-describedby', 'tip-1');
  });

  it('hides on Escape key', async () => {
    const { container } = render(Tooltip, {
      props: { text: 'Help text', id: 'tip-1', children: (() => {}) as never },
    });
    const wrapper = container.querySelector('.snaplify-tooltip-wrapper')!;
    await userEvent.hover(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    // Dispatch keydown directly on the wrapper since it has the handler
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // Wait for Svelte reactivity
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('accepts a class prop', () => {
    const { container } = render(Tooltip, {
      props: { text: 'Tip', id: 'tip-1', class: 'custom', children: (() => {}) as never },
    });
    expect(container.querySelector('.snaplify-tooltip-wrapper')?.className).toContain('custom');
  });
});
