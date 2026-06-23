import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import type { BlockTuple } from '@commonpub/editor';
import BlockTabsView from '../BlockTabsView.vue';

// The recursive renderer is a Nuxt auto-import; stub it (its own tests cover it).
const stubs = { BlocksBlockContentRenderer: { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' } };
const content: { tabs: { label: string; blocks: BlockTuple[] }[] } = {
  tabs: [
    { label: 'Track A', blocks: [['heading', { text: 'Devs', level: 2 }]] },
    { label: 'Track B', blocks: [['paragraph', { html: '<p>Startups</p>' }], ['table', { header: ['x'], rows: [] }]] },
  ],
};

describe('BlockTabsView', () => {
  it('renders a tab per panel, first active, each panel via the renderer', () => {
    const { getByRole, container } = render(BlockTabsView, { props: { content }, global: { stubs } });
    expect(getByRole('tab', { name: 'Track A' }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: 'Track B' }).getAttribute('aria-selected')).toBe('false');
    expect(container.querySelectorAll('.render-stub').length).toBe(2); // all panels in DOM (v-show)
    expect(getByRole('tab', { name: 'Track A' }).getAttribute('aria-controls')).toBeTruthy();
  });

  it('switches the active tab on click', async () => {
    const { getByRole } = render(BlockTabsView, { props: { content }, global: { stubs } });
    await fireEvent.click(getByRole('tab', { name: 'Track B' }));
    expect(getByRole('tab', { name: 'Track B' }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: 'Track A' }).getAttribute('aria-selected')).toBe('false');
  });

  it('moves selection with ArrowRight (roving tablist)', async () => {
    const { getByRole } = render(BlockTabsView, { props: { content }, global: { stubs } });
    await fireEvent.keyDown(getByRole('tab', { name: 'Track A' }), { key: 'ArrowRight' });
    expect(getByRole('tab', { name: 'Track B' }).getAttribute('aria-selected')).toBe('true');
  });

  it('gives each tabs block document-unique ids (useId)', () => {
    const { container } = render(BlockTabsView, { props: { content }, global: { stubs } });
    const a = container.querySelector('[role="tab"]')!.id;
    const panel = container.querySelector('[role="tabpanel"]')!.id;
    expect(a).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(container.querySelector('[role="tab"]')!.getAttribute('aria-controls')).toBe(panel);
  });

  it('renders nothing without tabs', () => {
    const { container } = render(BlockTabsView, { props: { content: { tabs: [] } }, global: { stubs } });
    expect(container.querySelector('.cpub-tabs')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockTabsView, { props: { content }, global: { stubs } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
