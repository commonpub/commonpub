import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import CriteriaBarBlock from '../CriteriaBarBlock.vue';
import { CONTEST_RUBRIC_KEY } from '../../../../utils/contestBlocks';

const base = { content: { heading: 'Scoring', items: [{ label: 'Innovation', weight: 35, color: 'accent' }], showLegend: true } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('CriteriaBarBlock', () => {
  it('renders a row per criterion with a live preview', () => {
    const { container } = render(CriteriaBarBlock, { props: base });
    expect(container.querySelector('.cpub-cbedit-label')).toBeTruthy();
    expect(container.querySelectorAll('.cpub-cbedit-seg').length).toBe(1);
  });

  it('emits update with a new criterion on Add', async () => {
    const { getByText, emitted } = render(CriteriaBarBlock, { props: base });
    await fireEvent.click(getByText(/Add criterion/));
    const last = (emitted().update?.at(-1) as [Record<string, unknown>])[0];
    expect((last.items as unknown[]).length).toBe(2);
  });

  it('emits update when a criterion label changes', async () => {
    const { container, emitted } = render(CriteriaBarBlock, { props: base });
    await fireEvent.update(container.querySelector('.cpub-cbedit-label') as HTMLInputElement, 'Originality');
    const last = (emitted().update?.at(-1) as [Record<string, unknown>])[0];
    expect((last.items as { label: string }[])[0]!.label).toBe('Originality');
  });

  it('emits update when a color swatch is picked', async () => {
    const { container, emitted } = render(CriteriaBarBlock, { props: base });
    const tealSwatch = container.querySelector('.cpub-cbedit-swatch[aria-label="Use teal"]') as HTMLButtonElement;
    await fireEvent.click(tealSwatch);
    const last = (emitted().update?.at(-1) as [Record<string, unknown>])[0];
    expect((last.items as { color: string }[])[0]!.color).toBe('teal');
  });

  it('has no "Use rubric" button when no contest rubric is provided', () => {
    const { queryByText } = render(CriteriaBarBlock, { props: base });
    expect(queryByText(/Use rubric/)).toBeNull();
  });

  it('fills items from the contest rubric when provided', async () => {
    const rubric = ref([{ label: 'Innovation', weight: 35 }, { label: 'Impact', weight: 65 }, { label: '', weight: 0 }]);
    const { getByText, emitted } = render(CriteriaBarBlock, {
      props: { content: { items: [] } },
      global: { provide: { [CONTEST_RUBRIC_KEY as symbol]: rubric } },
    });
    await fireEvent.click(getByText(/Use rubric/));
    const items = lastUpdate(emitted()).items as { label: string; weight: number }[];
    expect(items.map((i) => [i.label, i.weight])).toEqual([['Innovation', 35], ['Impact', 65]]);
  });

  it('passes an axe scan', async () => {
    const { container } = render(CriteriaBarBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
