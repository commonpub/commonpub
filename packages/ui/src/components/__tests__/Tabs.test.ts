import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Tabs from '../Tabs.vue';

const testTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'settings', label: 'Settings' },
];

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'overview' },
    });
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('has tablist role', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'overview' },
    });
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('marks active tab with aria-selected', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'details' },
    });
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('applies active class to selected tab', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'overview' },
    });
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].classList.contains('cpub-tabs__tab--active')).toBe(true);
    expect(tabs[1].classList.contains('cpub-tabs__tab--active')).toBe(false);
  });

  it('emits update:modelValue on tab click', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'overview' },
    });
    await fireEvent.click(screen.getByText('Details'));
    expect(emitted()['update:modelValue']).toEqual([['details']]);
  });

  it('renders tabpanel', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'overview' },
      slots: { default: 'Panel content' },
    });
    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByText('Panel content')).toBeTruthy();
  });

  it('sets correct tabindex on tabs', () => {
    render(Tabs, {
      props: { tabs: testTabs, modelValue: 'details' },
    });
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
  });
});
