// Client mirror of the server VALID_TRANSITIONS map (@commonpub/server contest.ts).
// Single source of truth for the contest lifecycle controls in ContestHero and
// the contest edit page — keeps the offered buttons in sync with what the API
// accepts. If the server map changes, change this in lockstep (a client-only or
// server-only edit silently desyncs: the UI offers a button the API rejects).

export const CONTEST_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['upcoming', 'active', 'cancelled'],
  upcoming: ['draft', 'active', 'cancelled'],
  active: ['upcoming', 'paused', 'judging', 'cancelled'],
  paused: ['active', 'upcoming', 'judging', 'cancelled'],
  judging: ['active', 'paused', 'completed', 'cancelled'],
  completed: ['judging'],
  cancelled: ['draft', 'upcoming'],
};

/** Display metadata for a transition target. `tone` styles the button (go/warn/danger). */
export const CONTEST_STATUS_ACTION: Record<string, { label: string; icon: string; tone?: 'go' | 'warn' | 'danger' }> = {
  draft: { label: 'Move to Draft', icon: 'fa-pen-ruler' },
  upcoming: { label: 'Set Upcoming', icon: 'fa-clock' },
  active: { label: 'Activate', icon: 'fa-play', tone: 'go' },
  paused: { label: 'Pause', icon: 'fa-pause', tone: 'warn' },
  judging: { label: 'Start Judging', icon: 'fa-gavel' },
  completed: { label: 'Complete & Publish', icon: 'fa-flag-checkered', tone: 'go' },
  cancelled: { label: 'Cancel', icon: 'fa-ban', tone: 'danger' },
};

export function contestTransitionsFrom(status: string | undefined): string[] {
  return CONTEST_VALID_TRANSITIONS[status ?? 'upcoming'] ?? [];
}

export function contestStatusAction(s: string): { label: string; icon: string; tone?: string } {
  return CONTEST_STATUS_ACTION[s] ?? { label: s, icon: 'fa-circle' };
}

/**
 * The confirmation for a status change, or null when it needs none. Every
 * change that notifies entrants or can't be quietly undone confirms, and says
 * who hears about it. The hero applied every change except Cancel on a single
 * click, so "Complete & Publish" one button away from "Pause" ranked and
 * announced winners with no prompt (session 260). Shared by ContestHero and the
 * contest editor so the two can't drift.
 */
export function contestTransitionConfirm(from: string | undefined, to: string): string | null {
  switch (to) {
    case 'judging':
      return 'Start judging? Submissions and proposals close, every entrant gets a "Judging Started" notification, and accepted judges are told they can score.';
    case 'active':
      return from === 'judging'
        ? 'Reopen the contest? Entrants can submit and attach new entries again, and every entrant, including any not advanced, is told the contest is "now accepting submissions". Between judging rounds (a build sprint), leave the contest in Judging instead.'
        : 'Open the contest? Submissions open and every entrant is notified.';
    case 'paused':
      return 'Pause the contest? Submissions and scoring stop until you resume, and every entrant is notified.';
    case 'completed':
      return 'Complete the contest and publish results? Final ranks are calculated from the current scores, winners are congratulated and every other entrant is told results are posted.';
    case 'cancelled':
      return 'Cancel this contest? Every entrant is notified.';
    default:
      return null;
  }
}
