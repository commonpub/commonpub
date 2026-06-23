import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import RoadmapBlock from '../RoadmapBlock.vue';
import { CONTEST_SCHEDULE_KEY } from '../../../../utils/contestBlocks';

const base = { content: { heading: 'Roadmap', items: [
  { date: 'Jun 30', title: 'Proposals open', tone: 'default' },
  { date: 'Oct 22', title: 'Results', tone: 'highlight' },
] } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('RoadmapBlock', () => {
  it('renders one editor row per milestone tinted by tone', () => {
    const { container } = render(RoadmapBlock, { props: base });
    expect(container.querySelectorAll('.cpub-rmedit-row').length).toBe(2);
    expect(container.querySelector('.cpub-rmedit-highlight')).toBeTruthy();
  });

  it('adds, edits, and removes milestones', async () => {
    const { getByText, container, emitted } = render(RoadmapBlock, { props: base });
    await fireEvent.click(getByText(/Add milestone/));
    expect((lastUpdate(emitted()).items as unknown[]).length).toBe(3);
    await fireEvent.update(container.querySelector('[aria-label="Milestone 1 title"]') as HTMLInputElement, 'Kickoff');
    expect((lastUpdate(emitted()).items as { title: string }[])[0]!.title).toBe('Kickoff');
  });

  it('reorders milestones with the move controls', async () => {
    const { container, emitted } = render(RoadmapBlock, { props: base });
    await fireEvent.click(container.querySelector('[aria-label="Move milestone 1 down"]') as HTMLButtonElement);
    expect((lastUpdate(emitted()).items as { title: string }[]).map((i) => i.title)).toEqual(['Results', 'Proposals open']);
  });

  it('changes a milestone tone', async () => {
    const { container, emitted } = render(RoadmapBlock, { props: base });
    await fireEvent.update(container.querySelector('[aria-label="Milestone 1 style"]') as HTMLSelectElement, 'accent');
    expect((lastUpdate(emitted()).items as { tone: string }[])[0]!.tone).toBe('accent');
  });

  it('shows "Pull from schedule" only when a schedule is provided, and seeds from it', async () => {
    const without = render(RoadmapBlock, { props: base });
    expect(without.queryByText(/Pull from schedule/)).toBeNull();

    const schedule = ref([{ date: 'Jun 30', title: 'Submissions open', tone: 'default' as const }, { title: 'Results announced', tone: 'highlight' as const }]);
    const { getByText, emitted } = render(RoadmapBlock, {
      props: { content: { items: [] } },
      global: { provide: { [CONTEST_SCHEDULE_KEY as symbol]: schedule } },
    });
    await fireEvent.click(getByText(/Pull from schedule/));
    expect((lastUpdate(emitted()).items as { title: string }[]).map((i) => i.title)).toEqual(['Submissions open', 'Results announced']);
  });

  it('passes an axe scan', async () => {
    const { container } = render(RoadmapBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
