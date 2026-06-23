import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestBodyCanvas from '../ContestBodyCanvas.vue';

// BlockCanvas (real package import in the SFC) + the view renderer (a Nuxt
// auto-import absent in vitest) are stubbed; this focuses on the tab + mode
// structure and the preview/code derivation from the active editor.
const stubs = {
  BlockCanvas: { props: ['blockEditor', 'blockTypes'], template: '<div class="bc-stub" />' },
  BlocksBlockContentRenderer: { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' },
};

// A minimal BlockEditor stand-in — only the surface ContestBodyCanvas touches.
function fakeEditor(tuples: [string, Record<string, unknown>][] = []) {
  return { blocks: ref([]), toBlockTuples: () => tuples } as unknown as never;
}

const groups = [{ name: 'Basic', blocks: [{ type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' }] }];

function mount(props: Record<string, unknown> = {}) {
  return render(ContestBodyCanvas, {
    props: { editor: fakeEditor(), groups, activeTab: 'overview', mode: 'write', ...props },
    global: { stubs },
  });
}

describe('ContestBodyCanvas', () => {
  it('renders Overview/Rules/Prizes tabs with the active one selected', () => {
    const { getByRole } = mount();
    expect(getByRole('tab', { name: /Overview/ }).getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tab', { name: /Rules/ }).getAttribute('aria-selected')).toBe('false');
    expect(getByRole('tab', { name: /Prizes/ }).getAttribute('aria-selected')).toBe('false');
  });

  it('emits update:activeTab when another tab is clicked', async () => {
    const { getByRole, emitted } = mount();
    await fireEvent.click(getByRole('tab', { name: /Rules/ }));
    expect(emitted()['update:activeTab']?.[0]).toEqual(['rules']);
  });

  it('moves the active tab with the arrow keys (roving tablist)', async () => {
    const { getByRole, emitted } = mount();
    await fireEvent.keyDown(getByRole('tab', { name: /Overview/ }), { key: 'ArrowRight' });
    expect(emitted()['update:activeTab']?.[0]).toEqual(['rules']);
  });

  it('shows the Write/Preview/Code switch and emits update:mode', async () => {
    const { getByRole, emitted } = mount();
    expect(getByRole('button', { name: /Write/ }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(getByRole('button', { name: /Preview/ }));
    expect(emitted()['update:mode']?.[0]).toEqual(['preview']);
  });

  it('renders the canvas stub in write mode', () => {
    const { container } = mount({ mode: 'write' });
    expect(container.querySelector('.bc-stub')).toBeTruthy();
  });

  it('renders the active editor blocks through the view renderer in preview mode', () => {
    const { container } = mount({ mode: 'preview', editor: fakeEditor([['heading', { text: 'Hi', level: 2 }]]) });
    const stub = container.querySelector('.render-stub');
    expect(stub).toBeTruthy();
    expect(stub?.getAttribute('data-count')).toBe('1');
  });

  it('renders read-only BlockTuple JSON in code mode', () => {
    const { container } = mount({ mode: 'code', editor: fakeEditor([['heading', { text: 'Hi', level: 2 }]]) });
    const pre = container.querySelector('pre.cpub-cbc-code');
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain('heading');
  });

  it('passes an axe scan', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
