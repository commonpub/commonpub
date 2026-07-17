import type { ContestStage, ContestSubmissionTemplateField } from '@commonpub/schema';

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

// ─── Pure stage-array operations (used by ContestStagesEditor; unit-tested) ───

export function newStageId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `s-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function blankStage(): ContestStage {
  return { id: newStageId(), name: '', kind: 'custom' };
}

/** The three standard stages seeded when an operator chooses to customise. */
export function seedStandardStages(c: { startDate?: string | null; endDate?: string | null; judgingEndDate?: string | null }): ContestStage[] {
  const i = (d?: string | null): string | undefined => (d ? new Date(d).toISOString() : undefined);
  return [
    { id: newStageId(), name: 'Submissions', kind: 'submission', startsAt: i(c.startDate), endsAt: i(c.endDate) },
    { id: newStageId(), name: 'Judging', kind: 'review', endsAt: i(c.judgingEndDate) ?? i(c.endDate) },
    { id: newStageId(), name: 'Results', kind: 'results' },
  ];
}

export function withStageAdded(stages: ContestStage[]): ContestStage[] {
  return [...stages, blankStage()];
}

export function withStageDuplicated(stages: ContestStage[], i: number): ContestStage[] {
  const src = stages[i];
  if (!src) return stages;
  const copy: ContestStage = { ...src, id: newStageId(), name: `${src.name} (copy)`, core: false };
  return [...stages.slice(0, i + 1), copy, ...stages.slice(i + 1)];
}

export function withStageRemoved(stages: ContestStage[], i: number): ContestStage[] {
  return stages.filter((_, idx) => idx !== i);
}

export function withStageMoved(stages: ContestStage[], i: number, dir: -1 | 1): ContestStage[] {
  const j = i + dir;
  if (j < 0 || j >= stages.length) return stages;
  const next = [...stages];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

// ─── Submission-template field operations (per-stage artifacts) ───

/** Derive a stable machine key (`^[a-z0-9_]+$`, max 40) from a human label. */
export function fieldKeyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return key || 'field';
}

export function blankTemplateField(): ContestSubmissionTemplateField {
  return { key: '', label: '', type: 'text', required: false };
}

type FieldType = ContestSubmissionTemplateField['type'];
type TemplateField = ContestSubmissionTemplateField;

// ─── Array-level template ops (operate on ONE stage's submissionTemplate) ───
// The extracted ContestStageTemplateEditor works on a plain field array; the
// stage-indexed `withTemplate*` wrappers below delegate to these so both surfaces
// share one implementation (and the existing unit tests still exercise it).

export function templateFieldAdded(t: TemplateField[]): TemplateField[] {
  return [...t, blankTemplateField()];
}

export function templateFieldSet(t: TemplateField[], fi: number, patch: Partial<TemplateField>): TemplateField[] {
  return t.map((f, idx) => (idx === fi ? { ...f, ...patch } : f));
}

/**
 * Set a field's label, keeping the machine key in sync while it still "tracks"
 * the label (empty, or equal to the auto-key of the previous label). A key the
 * organizer edited by hand is left alone — once entrants have submitted, keys
 * are what artifact values hang off, so they must stay stable.
 */
export function templateFieldLabelChanged(t: TemplateField[], fi: number, label: string): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  const tracksLabel = !field.key || field.key === fieldKeyFromLabel(field.label);
  return templateFieldSet(t, fi, tracksLabel ? { label, key: fieldKeyFromLabel(label) } : { label });
}

export function templateFieldRemoved(t: TemplateField[], fi: number): TemplateField[] {
  return t.filter((_, idx) => idx !== fi);
}

/**
 * Change a template field's type AND normalize the type-specific ancillary props
 * so the stored field stays coherent (Phase 4): `address` forces `pii`; leaving
 * `select` drops `options`; leaving `agreement` drops `terms`/`termsFormat`/
 * `mustAccept`; entering `select` seeds one blank option; entering `agreement`
 * defaults `mustAccept` true.
 */
export function templateFieldTypeChanged(t: TemplateField[], fi: number, type: FieldType): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  const patch: Partial<TemplateField> = { type };
  patch.options = type === 'select' ? (field.options?.length ? field.options : [{ value: '', label: '' }]) : undefined;
  if (type === 'agreement') {
    patch.mustAccept = field.mustAccept ?? true;
  } else {
    patch.terms = undefined;
    patch.termsFormat = undefined;
    patch.mustAccept = undefined;
  }
  if (type === 'address') patch.pii = true;
  return templateFieldSet(t, fi, patch);
}

export function templateOptionAdded(t: TemplateField[], fi: number): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  return templateFieldSet(t, fi, { options: [...(field.options ?? []), { value: '', label: '' }] });
}

export function templateOptionSet(
  t: TemplateField[],
  fi: number,
  oi: number,
  patch: Partial<{ value: string; label: string }>,
): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  const options = (field.options ?? []).map((o, idx) => (idx === oi ? { ...o, ...patch } : o));
  return templateFieldSet(t, fi, { options });
}

export function templateOptionRemoved(t: TemplateField[], fi: number, oi: number): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  return templateFieldSet(t, fi, { options: (field.options ?? []).filter((_, idx) => idx !== oi) });
}

// ─── Stage-indexed wrappers (delegate to the array-level ops above) ───

function withTemplate(stages: ContestStage[], i: number, template: TemplateField[]): ContestStage[] {
  return stages.map((s, idx) => (idx === i ? { ...s, submissionTemplate: template.length ? template : undefined } : s));
}

export function withTemplateFieldAdded(stages: ContestStage[], i: number): ContestStage[] {
  return withTemplate(stages, i, templateFieldAdded(stages[i]?.submissionTemplate ?? []));
}

export function withTemplateFieldSet(stages: ContestStage[], i: number, fi: number, patch: Partial<TemplateField>): ContestStage[] {
  return withTemplate(stages, i, templateFieldSet(stages[i]?.submissionTemplate ?? [], fi, patch));
}

export function withTemplateFieldLabelChanged(stages: ContestStage[], i: number, fi: number, label: string): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateFieldLabelChanged(stages[i]!.submissionTemplate!, fi, label));
}

export function withTemplateFieldRemoved(stages: ContestStage[], i: number, fi: number): ContestStage[] {
  return withTemplate(stages, i, templateFieldRemoved(stages[i]?.submissionTemplate ?? [], fi));
}

export function withTemplateFieldTypeChanged(stages: ContestStage[], i: number, fi: number, type: FieldType): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateFieldTypeChanged(stages[i]!.submissionTemplate!, fi, type));
}

export function withTemplateOptionAdded(stages: ContestStage[], i: number, fi: number): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateOptionAdded(stages[i]!.submissionTemplate!, fi));
}

export function withTemplateOptionSet(
  stages: ContestStage[],
  i: number,
  fi: number,
  oi: number,
  patch: Partial<{ value: string; label: string }>,
): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateOptionSet(stages[i]!.submissionTemplate!, fi, oi, patch));
}

export function withTemplateOptionRemoved(stages: ContestStage[], i: number, fi: number, oi: number): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateOptionRemoved(stages[i]!.submissionTemplate!, fi, oi));
}

/** Human label for each template field type (for the editor dropdown). */
export const TEMPLATE_FIELD_TYPE_LABEL: Record<ContestSubmissionTemplateField['type'], string> = {
  text: 'Short text',
  textarea: 'Long text',
  url: 'Link (URL)',
  email: 'Email address',
  number: 'Number',
  select: 'Dropdown (select)',
  radio: 'Choice (radio buttons)',
  checkbox: 'Checkbox',
  date: 'Date',
  tel: 'Phone number',
  agreement: 'Agreement (terms to accept)',
  address: 'Mailing address',
  section: 'Section header',
};

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

/** What each stage kind actually DOES — shown under the editor's type picker so
 *  organisers understand the behaviour they're choosing. */
export const STAGE_KIND_HELP: Record<ContestStage['kind'], string> = {
  submission: 'Entrants submit (or, in a later round, refine) entries. The hero countdown targets this stage’s end date.',
  review: 'Judges score entries on a rubric. End a review stage with an Advancement cut (Top-N) to pick who continues. Add per-round criteria below for multi-round contests.',
  interim: 'A working period, e.g. a build sprint. The surviving cohort refines their existing entries; no new entrants.',
  results: 'Final standings are published (ranks calculated from the latest judging round).',
  event: 'A real-world milestone or showcase (date + location). Informational, no entry/judging behaviour.',
  custom: 'An arbitrary dated milestone. No behaviour, just appears on the timeline.',
};
