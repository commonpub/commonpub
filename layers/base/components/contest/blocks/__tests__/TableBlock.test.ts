import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import TableBlock from '../TableBlock.vue';

const base = { content: { caption: 'Dates', header: ['Milestone', 'Date'], rows: [['Launch', 'Jul 31']] } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('TableBlock', () => {
  it('renders an editable grid (header + body inputs)', () => {
    const { container } = render(TableBlock, { props: base });
    expect(container.querySelectorAll('.cpub-tedit-hcell').length).toBe(2);
    expect(container.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('adds a column (header + every row grows)', async () => {
    const { getByText, emitted } = render(TableBlock, { props: base });
    await fireEvent.click(getByText('Column'));
    const u = lastUpdate(emitted());
    expect((u.header as string[]).length).toBe(3);
    expect((u.rows as string[][])[0]!.length).toBe(3);
  });

  it('adds a row sized to the header', async () => {
    const { getByText, emitted } = render(TableBlock, { props: base });
    await fireEvent.click(getByText('Row'));
    const u = lastUpdate(emitted());
    expect((u.rows as string[][]).length).toBe(2);
    expect((u.rows as string[][])[1]!.length).toBe(2);
  });

  it('edits a body cell', async () => {
    const { container, emitted } = render(TableBlock, { props: base });
    const cell = container.querySelector('tbody input') as HTMLInputElement;
    await fireEvent.update(cell, 'Kickoff');
    expect((lastUpdate(emitted()).rows as string[][])[0]![0]).toBe('Kickoff');
  });

  it('disables removing the last column', () => {
    const { container } = render(TableBlock, { props: { content: { header: ['Only'], rows: [['x']] } } });
    expect((container.querySelector('.cpub-tedit-th .cpub-tedit-del') as HTMLButtonElement).disabled).toBe(true);
  });

  it('passes an axe scan', async () => {
    const { container } = render(TableBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
