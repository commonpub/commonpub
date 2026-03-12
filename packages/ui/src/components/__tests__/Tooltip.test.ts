import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Tooltip from '../Tooltip.vue';

describe('Tooltip', () => {
  it('renders trigger content', () => {
    render(Tooltip, {
      props: { content: 'Tooltip text' },
      slots: { default: '<button>Hover me</button>' },
    });
    expect(screen.getByText('Hover me')).toBeTruthy();
  });

  it('does not show tooltip initially', () => {
    render(Tooltip, {
      props: { content: 'Tip' },
      slots: { default: '<button>Trigger</button>' },
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip with role="tooltip" after hover and delay', async () => {
    vi.useFakeTimers();
    render(Tooltip, {
      props: { content: 'Help text' },
      slots: { default: '<button>Trigger</button>' },
    });

    const wrapper = screen.getByText('Trigger').closest('.cpub-tooltip-wrapper')!;
    await fireEvent.mouseEnter(wrapper);
    vi.advanceTimersByTime(300);
    await vi.runAllTicks();

    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text');
    vi.useRealTimers();
  });

  it('shows tooltip on focusin after delay', async () => {
    vi.useFakeTimers();
    render(Tooltip, {
      props: { content: 'Focus tip' },
      slots: { default: '<button>Trigger</button>' },
    });

    const wrapper = screen.getByText('Trigger').closest('.cpub-tooltip-wrapper')!;
    await fireEvent.focusIn(wrapper);
    vi.advanceTimersByTime(300);
    await vi.runAllTicks();

    expect(screen.getByRole('tooltip')).toHaveTextContent('Focus tip');
    vi.useRealTimers();
  });

  it('hides tooltip on mouseleave', async () => {
    vi.useFakeTimers();
    render(Tooltip, {
      props: { content: 'Tip' },
      slots: { default: '<button>Trigger</button>' },
    });

    const wrapper = screen.getByText('Trigger').closest('.cpub-tooltip-wrapper')!;
    await fireEvent.mouseEnter(wrapper);
    vi.advanceTimersByTime(300);
    await vi.runAllTicks();
    expect(screen.getByRole('tooltip')).toBeTruthy();

    await fireEvent.mouseLeave(wrapper);
    vi.advanceTimersByTime(100);
    await vi.runAllTicks();
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});
