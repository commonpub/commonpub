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
