import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import CompareColumnsBlock from '../CompareColumnsBlock.vue';

const base = { content: { eyebrow: 'Scope', heading: 'Build to help', columns: [
  { tone: 'positive', title: 'Encouraged', items: ['Edge AI'] },
  { tone: 'negative', title: 'Out of scope', items: ['Weapons'] },
] } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('CompareColumnsBlock', () => {
  it('renders one editor per column tinted by tone', () => {
    const { container } = render(CompareColumnsBlock, { props: base });
    expect(container.querySelectorAll('.cpub-cmpedit-col').length).toBe(2);
    expect(container.querySelector('.cpub-cmpedit-positive')).toBeTruthy();
    expect(container.querySelector('.cpub-cmpedit-negative')).toBeTruthy();
  });

  it('emits update with a neutral column on Add column', async () => {
    const { getByText, emitted } = render(CompareColumnsBlock, { props: base });
    await fireEvent.click(getByText(/Add column/));
    const cols = lastUpdate(emitted()).columns as { tone: string }[];
    expect(cols.length).toBe(3);
    expect(cols[2]!.tone).toBe('neutral');
  });

  it('emits update when a column tone changes', async () => {
    const { container, emitted } = render(CompareColumnsBlock, { props: base });
    await fireEvent.update(container.querySelector('[aria-label="Column 1 tone"]') as HTMLSelectElement, 'neutral');
    expect((lastUpdate(emitted()).columns as { tone: string }[])[0]!.tone).toBe('neutral');
  });

  it('adds and edits items within a column', async () => {
    const { container, getAllByText, emitted } = render(CompareColumnsBlock, { props: base });
    await fireEvent.click(getAllByText(/Add item/)[0] as HTMLElement);
    expect(((lastUpdate(emitted()).columns as { items: string[] }[])[0]!.items).length).toBe(2);
    await fireEvent.update(container.querySelector('[aria-label="Column 1 item 1"]') as HTMLInputElement, 'Edge AI projects');
    expect((lastUpdate(emitted()).columns as { items: string[] }[])[0]!.items[0]).toBe('Edge AI projects');
  });

  it('emits the footer note', async () => {
    const { container, emitted } = render(CompareColumnsBlock, { props: base });
    await fireEvent.update(container.querySelector('[aria-label="Footer note"]') as HTMLInputElement, 'Ask if in doubt.');
    expect(lastUpdate(emitted()).note).toBe('Ask if in doubt.');
  });

  it('passes an axe scan', async () => {
    const { container } = render(CompareColumnsBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
