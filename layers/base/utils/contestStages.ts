import type { ContestStage } from '@commonpub/schema';

// Client mirror of the pure stage helpers in @commonpub/server `contest.ts`
// (synthesizeStages / normalizeStages / currentStage). Deliberately duplicated —
// importing the server package into the browser bundle would pull in DB drivers.
// If the server derivation changes, change this in lockstep (same contract as the
// VALID_TRANSITIONS mirror in ContestHero/edit.vue).

export interface StageSource {
  status: string;
  startDate: string;
  endDate: string;
  judgingEndDate: string | null;
  stages?: ContestStage[] | null;
  currentStageId?: string | null;
}

const iso = (d: string | null | undefined): string | undefined => (d ? new Date(d).toISOString() : undefined);

/** Classic Submissions → Judging → Results, synthesized from status + dates. */
export function synthesizeStages(c: StageSource): ContestStage[] {
  return [
    { id: 'core-submission', name: 'Submissions', kind: 'submission', core: true, startsAt: iso(c.startDate), endsAt: iso(c.endDate) },
    { id: 'core-review', name: 'Judging', kind: 'review', core: true, endsAt: iso(c.judgingEndDate) ?? iso(c.endDate) },
    { id: 'core-results', name: 'Results', kind: 'results', core: true },
  ];
}

/** Explicit stages if defined, else the synthesized classic flow (the default). */
export function normalizeStages(c: StageSource): ContestStage[] {
  return c.stages && c.stages.length > 0 ? c.stages : synthesizeStages(c);
}

/** Id of the stage that is "now" — the resolvable `currentStageId`, else derived
 *  from `status`. Null while draft/cancelled (nothing running). */
export function currentStageId(c: StageSource): string | null {
  const stages = normalizeStages(c);
  if (c.currentStageId && stages.some((s) => s.id === c.currentStageId)) return c.currentStageId;
  switch (c.status) {
    case 'draft':
    case 'cancelled':
      return null;
    case 'completed':
      return (stages.find((s) => s.kind === 'results') ?? stages[stages.length - 1])?.id ?? null;
    case 'judging':
      return stages.find((s) => s.kind === 'review')?.id ?? null;
    default: // upcoming | active | paused
      return (stages.find((s) => s.kind === 'submission') ?? stages[0])?.id ?? null;
  }
}

/** FontAwesome icon (no `fa-solid` prefix) for each stage kind. */
export const STAGE_KIND_ICON: Record<ContestStage['kind'], string> = {
  submission: 'fa-pen-to-square',
  review: 'fa-gavel',
  interim: 'fa-screwdriver-wrench',
  results: 'fa-ranking-star',
  event: 'fa-flag-checkered',
  custom: 'fa-circle-dot',
};

/** Human label for each stage kind (for the editor dropdown). */
export const STAGE_KIND_LABEL: Record<ContestStage['kind'], string> = {
  submission: 'Submissions',
  review: 'Judging / Review',
  interim: 'Working period (sprint)',
  results: 'Results',
  event: 'Event / Showcase',
  custom: 'Custom milestone',
};
