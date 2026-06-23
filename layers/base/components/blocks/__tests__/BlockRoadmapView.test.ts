import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockRoadmapView from '../BlockRoadmapView.vue';
import { fmtRoadmapDate, roadmapFromSchedule } from '../../../utils/contestBlocks';

describe('roadmap helpers (pure)', () => {
  it('formats an ISO date as a short label, and empties bad input', () => {
    expect(fmtRoadmapDate('2026-06-30T12:00:00Z')).toMatch(/Jun/);
    expect(fmtRoadmapDate('')).toBe('');
    expect(fmtRoadmapDate('not-a-date')).toBe('');
  });

  it('derives roadmap items from custom stages (results -> highlight)', () => {
    const items = roadmapFromSchedule(
      [
        { name: 'Proposals open', kind: 'submission', startsAt: '2026-06-30T12:00:00Z', description: 'Registration opens.' },
        { name: 'Results', kind: 'results' },
        { name: '', kind: 'custom' }, // dropped (no name)
      ],
      {},
    );
    expect(items.map((i) => i.title)).toEqual(['Proposals open', 'Results']);
    expect(items[0]!.date).toMatch(/Jun/);
    expect(items[0]!.description).toBe('Registration opens.');
    expect(items[1]!.tone).toBe('highlight');
  });

  it('falls back to the core flow from schedule dates when no stages', () => {
    const items = roadmapFromSchedule([], { startDate: '2026-06-30T12:00:00Z', endDate: '2026-08-31T12:00:00Z', judgingEndDate: '2026-09-30T12:00:00Z' });
    expect(items.map((i) => i.title)).toEqual(['Submissions open', 'Submissions close', 'Judging ends', 'Results announced']);
    expect(items.at(-1)!.tone).toBe('highlight');
  });
});

describe('BlockRoadmapView', () => {
  const items = [
    { date: 'Jun 30', title: 'Launch and proposals open', description: 'The call goes out worldwide.' },
    { date: 'Sep 18', title: 'D.C. showcase', badge: 'Mid-term', tone: 'accent' as const },
    { date: 'Oct 22', title: 'Results and incubator', tone: 'highlight' as const },
  ];

  it('renders an eyebrow, heading, and one timeline node per milestone', () => {
    const { container, getByText } = render(BlockRoadmapView, { props: { content: { eyebrow: 'Key dates, 2026', heading: 'The 18-week roadmap', items } } });
    getByText('Key dates, 2026');
    getByText('The 18-week roadmap');
    expect(container.querySelectorAll('.cpub-rmap-item').length).toBe(3);
    expect(container.querySelectorAll('.cpub-rmap-dot').length).toBe(3);
    getByText('Mid-term');
  });

  it('applies the tone class per item', () => {
    const { container } = render(BlockRoadmapView, { props: { content: { items } } });
    expect(container.querySelector('.cpub-rmap-accent')).toBeTruthy();
    expect(container.querySelector('.cpub-rmap-highlight')).toBeTruthy();
  });

  it('keeps an item that has only a date (no title)', () => {
    const { container } = render(BlockRoadmapView, { props: { content: { items: [{ date: 'Jul 1', title: '' }] } } });
    expect(container.querySelectorAll('.cpub-rmap-item').length).toBe(1);
  });

  it('renders nothing without usable items', () => {
    const { container } = render(BlockRoadmapView, { props: { content: { items: [{ title: '', date: '' }] } } });
    expect(container.querySelector('.cpub-rmap')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockRoadmapView, { props: { content: { eyebrow: 'Key dates', heading: 'Roadmap', items } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
