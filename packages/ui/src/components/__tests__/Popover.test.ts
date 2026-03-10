import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Popover from '../Popover.svelte';

describe('Popover', () => {
  it('renders trigger', () => {
    const { container } = render(Popover, {
      props: {
        id: 'pop-1',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    const trigger = container.querySelector('.snaplify-popover-trigger');
    expect(trigger).toBeInTheDocument();
  });

  it('does not show content by default', () => {
    render(Popover, {
      props: {
        id: 'pop-1',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles content on trigger click', async () => {
    const { container } = render(Popover, {
      props: {
        id: 'pop-1',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    const trigger = container.querySelector('.snaplify-popover-trigger')!;

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { container } = render(Popover, {
      props: {
        id: 'pop-1',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    await userEvent.click(container.querySelector('.snaplify-popover-trigger')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has aria-controls linking trigger to content', async () => {
    const { container } = render(Popover, {
      props: {
        id: 'pop-1',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    const trigger = container.querySelector('.snaplify-popover-trigger')!;
    expect(trigger).toHaveAttribute('aria-controls', 'pop-1');
  });

  it('accepts a class prop', () => {
    const { container } = render(Popover, {
      props: {
        id: 'pop-1',
        class: 'custom',
        trigger: (() => {}) as never,
        children: (() => {}) as never,
      },
    });
    expect(container.querySelector('.snaplify-popover')?.className).toContain('custom');
  });
});
