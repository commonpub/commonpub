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
