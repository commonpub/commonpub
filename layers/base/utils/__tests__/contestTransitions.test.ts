import { describe, it, expect } from 'vitest';
import { CONTEST_VALID_TRANSITIONS, contestTransitionConfirm } from '../contestTransitions';

describe('contestTransitionConfirm (session 260)', () => {
  it('confirms every change that notifies entrants', () => {
    for (const to of ['judging', 'active', 'paused', 'completed', 'cancelled']) {
      expect(contestTransitionConfirm('judging', to), to).toBeTruthy();
    }
  });

  it('names who is notified on the consequential ones', () => {
    expect(contestTransitionConfirm('active', 'judging')).toMatch(/every entrant/i);
    expect(contestTransitionConfirm('judging', 'completed')).toMatch(/winners/i);
  });

  it('warns that reopening from judging re-admits entries, and points at the build-sprint rule', () => {
    const msg = contestTransitionConfirm('judging', 'active')!;
    expect(msg).toMatch(/not advanced/i);
    expect(msg).toMatch(/leave the contest in Judging/i);
    expect(contestTransitionConfirm('upcoming', 'active')).not.toMatch(/not advanced/i);
  });

  it('leaves quiet, reversible staging moves unconfirmed', () => {
    expect(contestTransitionConfirm('upcoming', 'draft')).toBeNull();
    expect(contestTransitionConfirm('draft', 'upcoming')).toBeNull();
  });

  it('covers every transition target the lifecycle offers that notifies', () => {
    const targets = new Set(Object.values(CONTEST_VALID_TRANSITIONS).flat());
    expect(targets.size).toBeGreaterThan(4); // guard: the map was actually walked
    for (const t of targets) {
      if (t === 'draft' || t === 'upcoming') continue;
      expect(contestTransitionConfirm('active', t), t).toBeTruthy();
    }
  });
});
