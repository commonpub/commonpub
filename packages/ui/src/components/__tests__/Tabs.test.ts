import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Tabs from '../Tabs.svelte';

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'advanced', label: 'Advanced' },
];

describe('Tabs', () => {
  it('renders tablist with tab buttons', () => {
    render(Tabs, { props: { tabs } });
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('first tab is selected by default', () => {
    render(Tabs, { props: { tabs } });
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabButtons[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('selects tab on click', async () => {
    const handler = vi.fn();
    render(Tabs, { props: { tabs, onchange: handler } });
    await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
    expect(handler).toHaveBeenCalledWith('security');
    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('navigates with ArrowRight', async () => {
    const handler = vi.fn();
    render(Tabs, { props: { tabs, onchange: handler } });
    const firstTab = screen.getByRole('tab', { name: 'General' });
    firstTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(handler).toHaveBeenCalledWith('security');
  });

  it('navigates with ArrowLeft (wraps)', async () => {
    const handler = vi.fn();
    render(Tabs, { props: { tabs, onchange: handler } });
    const firstTab = screen.getByRole('tab', { name: 'General' });
    firstTab.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(handler).toHaveBeenCalledWith('advanced');
  });

  it('navigates to first with Home', async () => {
    const handler = vi.fn();
    render(Tabs, { props: { tabs, activeTab: 'advanced', onchange: handler } });
    const lastTab = screen.getByRole('tab', { name: 'Advanced' });
    lastTab.focus();
    await userEvent.keyboard('{Home}');
    expect(handler).toHaveBeenCalledWith('general');
  });

  it('navigates to last with End', async () => {
    const handler = vi.fn();
    render(Tabs, { props: { tabs, onchange: handler } });
    const firstTab = screen.getByRole('tab', { name: 'General' });
    firstTab.focus();
    await userEvent.keyboard('{End}');
    expect(handler).toHaveBeenCalledWith('advanced');
  });

  it('tab panels have correct aria-labelledby', () => {
    render(Tabs, { props: { tabs } });
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels[0]).toHaveAttribute('aria-labelledby', 'tab-general');
  });

  it('only active panel is visible', () => {
    render(Tabs, { props: { tabs, activeTab: 'security' } });
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels.find((p) => p.id === 'panel-general')).toHaveAttribute('hidden');
    expect(panels.find((p) => p.id === 'panel-security')).not.toHaveAttribute('hidden');
  });

  it('accepts a class prop', () => {
    const { container } = render(Tabs, { props: { tabs, class: 'custom' } });
    expect(container.querySelector('.snaplify-tabs')?.className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Tabs, { props: { tabs } });
    await expectNoA11yViolations(container);
  });
});
