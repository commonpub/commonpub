import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import CriteriaBarBlock from '../CriteriaBarBlock.vue';

const base = { content: { heading: 'Scoring', items: [{ label: 'Innovation', weight: 35, color: 'accent' }], showLegend: true } };

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

  it('passes an axe scan', async () => {
    const { container } = render(CriteriaBarBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
