import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import TabsBlock from '../TabsBlock.vue';

// ContestTabPanel nests a real BlockCanvas + useBlockEditor — stub it. The stub
// exposes a button that emits update:blocks so we can test the setBlocks path.
const ContestTabPanel = defineComponent({
  name: 'ContestTabPanel',
  props: { blocks: { type: Array, default: () => [] }, groups: { type: Array, default: () => [] } },
  emits: ['update:blocks'],
  setup(props, { emit }) {
    return () => h('div', { class: 'panel-stub', 'data-count': (props.blocks as unknown[]).length }, [
      h('button', { class: 'panel-emit', onClick: () => emit('update:blocks', [['paragraph', { html: '<p>x</p>' }]]) }, 'emit'),
    ]);
  },
});
const stubs = { ContestTabPanel };
const base = { content: { tabs: [{ label: 'Track A', blocks: [] }, { label: 'Track B', blocks: [[ 'heading', { text: 'B', level: 2 }]] }] } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('TabsBlock', () => {
  it('renders a selector per tab + the active panel', () => {
    const { container, getByText } = render(TabsBlock, { props: base, global: { stubs } });
    expect(container.querySelectorAll('.cpub-tabsedit-tab').length).toBe(2);
    getByText('Track A');
    expect(container.querySelector('.panel-stub')).toBeTruthy();
  });

  it('adds a tab', async () => {
    const { getByText, emitted } = render(TabsBlock, { props: base, global: { stubs } });
    await fireEvent.click(getByText(/Add tab/));
    expect((lastUpdate(emitted()).tabs as unknown[]).length).toBe(3);
  });

  it('renames the active tab', async () => {
    const { container, emitted } = render(TabsBlock, { props: base, global: { stubs } });
    await fireEvent.update(container.querySelector('.cpub-tabsedit-label') as HTMLInputElement, 'Developers');
    expect((lastUpdate(emitted()).tabs as { label: string }[])[0]!.label).toBe('Developers');
  });

  it('removes the active tab', async () => {
    const { container, emitted } = render(TabsBlock, { props: base, global: { stubs } });
    await fireEvent.click(container.querySelector('.cpub-tabsedit-mbtn--danger') as HTMLButtonElement);
    expect((lastUpdate(emitted()).tabs as unknown[]).length).toBe(1);
  });

  it('writes nested blocks back from the panel (update:blocks → setBlocks)', async () => {
    const { container, emitted } = render(TabsBlock, { props: base, global: { stubs } });
    await fireEvent.click(container.querySelector('.panel-emit') as HTMLButtonElement);
    const t = lastUpdate(emitted()).tabs as { blocks: unknown[] }[];
    expect(t[0]!.blocks.length).toBe(1); // active = tab 0
  });

  it('sets the deep-link url key', async () => {
    const { container, emitted } = render(TabsBlock, { props: base, global: { stubs } });
    await fireEvent.update(container.querySelector('.cpub-tabsedit-keyinput') as HTMLInputElement, 'track');
    expect(lastUpdate(emitted()).urlKey).toBe('track');
  });

  it('passes an axe scan', async () => {
    const { container } = render(TabsBlock, { props: base, global: { stubs } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
