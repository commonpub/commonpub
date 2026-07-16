import type { ContestStage } from '@commonpub/schema';
import type { StageSource } from './types.js';

// --- Phase B1: stage timeline helpers (pure — operate on a contest-like object) ---

const toIso = (d: Date | string | null | undefined): string | undefined =>
  d ? new Date(d).toISOString() : undefined;

/**
 * The classic Submissions → Judging → Results timeline, synthesized from the
 * status + date columns for contests that haven't defined explicit stages.
 * Stable ids let `currentStageId` reference them even for legacy contests.
 */
export function synthesizeStages(c: StageSource): ContestStage[] {
  return [
    { id: 'core-submission', name: 'Submissions', kind: 'submission', core: true, startsAt: toIso(c.startDate), endsAt: toIso(c.endDate) },
    { id: 'core-review', name: 'Judging', kind: 'review', core: true, endsAt: toIso(c.judgingEndDate) ?? toIso(c.endDate) },
    { id: 'core-results', name: 'Results', kind: 'results', core: true },
  ];
}

/**
 * The contest's stage timeline: its explicit `stages` if any are defined,
 * otherwise the synthesized classic flow. The standard flow is the zero-config
 * default — a contest with no `stages` renders identically to pre-B1.
 */
export function normalizeStages(c: StageSource): ContestStage[] {
  return c.stages && c.stages.length > 0 ? c.stages : synthesizeStages(c);
}

/**
 * The stage that is currently "now": the one `currentStageId` points at (if it
 * resolves), else derived from the coarse `status`. Null while draft/cancelled
 * (nothing is running). `status` remains the behavioural source of truth for
 * gating; this is for DISPLAY (hero pill, sidebar highlight, countdown label).
 */
export function currentStage(c: StageSource): ContestStage | null {
  const stages = normalizeStages(c);
  if (c.currentStageId) {
    const found = stages.find((s) => s.id === c.currentStageId);
    if (found) return found;
  }
  switch (c.status) {
    case 'draft':
    case 'cancelled':
      return null;
    case 'completed':
      return stages.find((s) => s.kind === 'results') ?? stages[stages.length - 1] ?? null;
    case 'judging':
      return stages.find((s) => s.kind === 'review') ?? null;
    default: // upcoming | active | paused
      return stages.find((s) => s.kind === 'submission') ?? stages[0] ?? null;
  }
}

/** True when an entry was culled at some review stage (Phase B2 cohort gate). */
export function isEliminated(entry: { stageState?: Array<{ status: string }> | null }): boolean {
  return !!entry.stageState?.some((s) => s.status === 'eliminated');
}

/** Stage kinds that represent a "something is due" deadline (an entrant must submit/refine by then). */
const DUE_STAGE_KINDS = new Set(['submission', 'interim']);

/** The next upcoming submission deadline for a contest + which stage it belongs to. */
export interface NextContestDeadline {
  /** The date to count down to / remind about. */
  at: Date;
  /** Stable id of the stage this deadline belongs to (`final` for the endDate fallback). */
  stageId: string;
  /** Human name of the stage, or null for the bare `final` fallback. */
  stageName: string | null;
  /**
   * True when this is the contest's OWN deadline — resolved from a SYNTHESIZED
   * (classic) stage or the bare final `endDate` fallback — rather than an EXPLICIT
   * user-defined sub-stage. Derived from PROVENANCE (did it come from the persisted
   * `stages` array?), never from the id string, so a user stage that happens to be
   * named `final`/`core-*` can't be misclassified. Callers that persist per-deadline
   * state (the reminder ledger) keep the historical un-scoped key when this is true,
   * so widening to stage-aware keys never re-fires an already-sent reminder.
   */
  isOwnDeadline: boolean;
}

/**
 * The next upcoming SUBMISSION deadline for a contest, relative to `now`: the
 * earliest future `endsAt` among the submission/interim stages — the moments an
 * entrant actually has to have something in. Falls back to the contest's final
 * `endDate` when there are no explicit stages, or none are still upcoming, so a
 * classic (stage-less) contest resolves to its end date exactly as before.
 *
 * This is the single source of truth for the deadline shown in the registration
 * confirmation email AND the milestone the reminder sweep counts down to, so a
 * STAGED contest surfaces the proposal deadline first (then the next stage, then
 * the final) instead of only the far-off final deadline.
 */
export function nextContestDeadline(c: StageSource, now: Date): NextContestDeadline {
  // Only EXPLICIT (persisted) stages get their own per-stage reminder cycle; a
  // synthesized classic timeline is the contest's own deadline.
  const hasExplicitStages = !!(c.stages && c.stages.length > 0);
  const upcoming = normalizeStages(c)
    .filter((s) => DUE_STAGE_KINDS.has(s.kind) && s.endsAt)
    .map((s) => ({ at: new Date(s.endsAt as string), stageId: s.id, stageName: s.name }))
    .filter((s) => !Number.isNaN(s.at.getTime()) && s.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (upcoming.length > 0) return { ...upcoming[0]!, isOwnDeadline: !hasExplicitStages };
  return { at: new Date(c.endDate), stageId: 'final', stageName: null, isOwnDeadline: true };
}
