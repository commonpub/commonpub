/**
 * Organizer judging overview (session 261): read only, per-judge progress for the
 * round, every entry that was in it with its scores and feedback. A judge's own
 * entry is not in their count; scores from other rounds never leak in.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import axe from 'axe-core';
import ContestJudgingOverview from '../ContestJudgingOverview.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()); },
});

const judges = [
  { userId: 'j1', role: 'judge', acceptedAt: '2026-10-01', userName: 'Ada', userUsername: 'ada' },
  { userId: 'j2', role: 'judge', acceptedAt: '2026-10-01', userName: 'Bo', userUsername: 'bo' },
  { userId: 'j3', role: 'judge', acceptedAt: null, userName: 'Cy', userUsername: 'cy' },
  { userId: 'g1', role: 'guest', acceptedAt: '2026-10-01', userName: 'Guest', userUsername: 'guest' },
];
const entry = (id: string, userId: string, scores: Array<[string, number, string?, string?]>, extra: Record<string, unknown> = {}) => ({
  id, userId, contentTitle: `Entry ${id}`, authorName: `Author ${id}`, authorUsername: `a${id}`,
  judgeScores: scores.map(([judgeId, score, roundId, feedback]) => ({ judgeId, score, roundId, feedback })),
  ...extra,
});

const mount = (props: Record<string, unknown>) =>
  render(ContestJudgingOverview, {
    props: { slug: 'demo', judges, roundId: 'screening', roundName: 'Screening', roundPhase: 'open', entries: [], ...props },
    global: { components: { NuxtLink } },
  });

describe('ContestJudgingOverview', () => {
  const entries = [
    entry('e1', 'u1', [['j1', 80, 'screening', 'Clear plan'], ['j2', 70, 'screening'], ['j1', 10, 'final']]),
    entry('e2', 'u2', [['j1', 60, 'screening']]),
    entry('e3', 'j2', []), // Bo's own entry
    entry('e4', 'u4', [], { eliminated: true, stageState: [{ stageId: 'proposals', status: 'eliminated' }] }),
  ];

  it('counts each judge against the entries they can score, excluding their own', () => {
    const { container } = mount({ entries });
    const rows = Array.from(container.querySelectorAll('.cpub-jov-judge')).map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(3); // guest is not on the scoring panel
    expect(rows[0]).toContain('Ada');
    expect(rows[0]).toContain('2 / 3 scored');
    expect(rows[1]).toContain('1 / 2 scored'); // Bo cannot score e3, his own
    expect(rows[2]).toContain('Invite not accepted');
  });

  it('shows only this round\'s scores, the average, and the feedback', () => {
    const { container } = mount({ entries });
    const first = container.querySelector('.cpub-jov-entry')!;
    expect(first.textContent).toContain('Average 75');
    expect(first.textContent).toContain('2 of 2 judges');
    const chips = Array.from(first.querySelectorAll('.cpub-jov-chip')).map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['Ada 80', 'Bo 70']); // never the final-round 10
    expect(first.querySelector('details')!.textContent).toContain('Clear plan');
    // e1: 2 of 2, e2: 1 of 2, e3: 0 of 1 (Bo can't score his own) → 3 of 5.
    expect(container.textContent).toContain('3 of 5 scores in');
  });

  it('leaves out entries cut in an earlier round', () => {
    const { container } = mount({ entries });
    expect(container.textContent).not.toContain('Entry e4');
    expect(container.querySelectorAll('.cpub-jov-entry')).toHaveLength(3);
  });

  it('a closed round keeps the entries it cut, marked, with their final scores', () => {
    const cut = entry('e5', 'u5', [['j1', 20, 'screening']], { eliminated: true, stageState: [{ stageId: 'screening', status: 'eliminated' }] });
    const { container } = mount({ entries: [...entries, cut], roundPhase: 'closed' });
    expect(container.textContent).toContain('Screening has closed');
    const row = Array.from(container.querySelectorAll('.cpub-jov-entry')).find((li) => li.textContent!.includes('Entry e5'))!;
    expect(row.textContent).toContain('Did not advance');
    expect(row.textContent).toContain('Average 20');
  });

  it('says when scoring has not opened, or there is no round at all', () => {
    expect(mount({ entries, roundPhase: 'upcoming' }).container.textContent).toContain('Scoring opens when Screening starts');
    expect(mount({ entries, roundId: null, roundName: null, roundPhase: null }).container.textContent).toContain('no review round yet');
  });

  it('is read only: no inputs or buttons to score with', () => {
    const { container } = mount({ entries });
    expect(container.querySelectorAll('input, textarea, button')).toHaveLength(0);
  });

  it('has no axe violations', async () => {
    const { container } = mount({ entries });
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
