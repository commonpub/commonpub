import { isConditionSourceField, type ContestStage, type ContestSubmissionTemplateField, type FormFieldCondition } from '@commonpub/schema';

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

/** The stage that is "now" (the resolved current stage object), or null. */
export function currentStage(c: StageSource): ContestStage | null {
  const cid = currentStageId(c);
  if (!cid) return null;
  return normalizeStages(c).find((s) => s.id === cid) ?? null;
}

/**
 * The deadline a running contest's hero/countdown + "submissions close" card
 * should target: the END of the CURRENT stage (e.g. the open proposal round),
 * NOT the contest's far-off final `endDate`. For a classic (synthesized) contest
 * the current submission stage's `endsAt` IS `endDate`, so behaviour is unchanged;
 * for a multi-stage contest it resolves to the current round's close (the reason a
 * "Submissions close in 137d / Dec 18" bug showed the final date, not the Sep-6
 * proposal deadline). Returns null when nothing is running (draft/cancelled) or
 * the current stage carries no `endsAt` — callers fall back to `endDate`.
 */
export function currentStageEnd(c: StageSource): string | null {
  return currentStage(c)?.endsAt ?? null;
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
// The extracted FormTemplateEditor works on a plain field array; the
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
export function templateFieldLabelChanged(
  t: TemplateField[],
  fi: number,
  label: string,
  lockedKeys?: ReadonlySet<string>,
): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  // A key that has already been SAVED is what every stored answer, private-field
  // entry and agreement acceptance hangs off, so it must survive a label edit.
  // Without this, fixing a typo in "Repositry URL" rewrites the key and orphans
  // every registrant's answer to that question — silently, with the old rows
  // still in the jsonb under a key nothing reads any more.
  //
  // Keys stay label-tracking for fields ADDED in this editing session, which is
  // where that behaviour is wanted (type the label, get a sensible key).
  const locked = lockedKeys?.has(field.key) === true;
  const tracksLabel = !locked && (!field.key || field.key === fieldKeyFromLabel(field.label));
  if (!tracksLabel) return templateFieldSet(t, fi, { label });
  const nextKey = fieldKeyFromLabel(label);
  const withLabel = templateFieldSet(t, fi, { label, key: nextKey });
  if (nextKey === field.key) return withLabel;
  // The key moved with the label, so every condition pointing at the OLD key has
  // to move with it. Without this, typing one more character into a source
  // field's label silently orphans each dependent — the repair pass would then
  // delete the very rules the operator just wrote, and nothing would say why.
  return withLabel.map((f, idx) =>
    idx !== fi && f.showWhen?.field === field.key ? { ...f, showWhen: { ...f.showWhen, field: nextKey } } : f,
  );
}

/**
 * Re-establish the `showWhen` invariants after ANY structural edit, dropping
 * whatever can no longer hold.
 *
 * Every builder op that can invalidate a condition routes through this, because
 * the alternative is a save that fails Zod with an error about a field the
 * operator was not editing. Deleting the "Are you a US entity?" checkbox, moving
 * it below the upload that depends on it, or retyping it to free text each leave
 * a condition that can never be satisfied — a field permanently invisible, or a
 * required field the entrant can never reach.
 *
 * It repairs rather than refuses on purpose: the operator's intent (delete this
 * field) is unambiguous, and the dependent field reverting to always-shown is the
 * safe direction. Silently keeping a broken rule is what hides data.
 *
 * Drops a condition when the source is missing, is at or after the dependent, or
 * is no longer a legal source type; prunes `equals` values the source can no
 * longer produce, and drops the whole condition when that empties it.
 */
export function templateConditionsRepaired(t: TemplateField[]): TemplateField[] {
  const indexByKey = new Map(t.map((f, i) => [f.key, i]));
  let changed = false;
  const next = t.map((field, i) => {
    const cond = field.showWhen;
    if (!cond) return field;
    const at = indexByKey.get(cond.field);
    const source = at === undefined ? undefined : t[at];
    if (at === undefined || at >= i || !source || !isConditionSourceField(source)) {
      changed = true;
      const { showWhen: _dropped, ...rest } = field;
      return rest as TemplateField;
    }
    const allowed = source.type === 'checkbox' ? ['true', 'false'] : (source.options ?? []).map((o) => o.value);
    const equals = cond.equals.filter((v) => allowed.includes(v));
    if (equals.length === cond.equals.length) return field;
    changed = true;
    if (!equals.length) {
      const { showWhen: _dropped, ...rest } = field;
      return rest as TemplateField;
    }
    return { ...field, showWhen: { ...cond, equals } };
  });
  return changed ? next : t;
}

/** Set or clear one field's condition. Clearing deletes the key outright rather
 *  than storing `undefined`, so the saved jsonb has no empty rule in it. */
export function templateFieldConditionSet(
  t: TemplateField[],
  fi: number,
  cond: FormFieldCondition | null,
): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  if (!cond) {
    const { showWhen: _dropped, ...rest } = field;
    return t.map((f, idx) => (idx === fi ? (rest as TemplateField) : f));
  }
  return templateFieldSet(t, fi, { showWhen: cond });
}

/**
 * The fields ABOVE `fi` that may key its condition: a closed-answer type with at
 * least one thing to match on. Exported so the builder offers exactly what the
 * validator accepts.
 */
export function conditionSourcesFor(t: TemplateField[], fi: number): TemplateField[] {
  return t
    .slice(0, Math.max(0, fi))
    .filter((f) => isConditionSourceField(f) && (f.type === 'checkbox' || (f.options ?? []).some((o) => o.value)));
}

/** The values a source field can produce, as {value,label} pairs for the builder. */
export function conditionValueChoices(source: TemplateField): Array<{ value: string; label: string }> {
  if (source.type === 'checkbox') {
    return [{ value: 'true', label: 'Checked' }, { value: 'false', label: 'Not checked' }];
  }
  return (source.options ?? []).filter((o) => o.value).map((o) => ({ value: o.value, label: o.label || o.value }));
}

export function templateFieldRemoved(t: TemplateField[], fi: number): TemplateField[] {
  return templateConditionsRepaired(t.filter((_, idx) => idx !== fi));
}

/** Move a field from index `fi` by `delta` (±1), clamped. Returns a new array
 *  (unchanged when the move would fall off either end). Powers keyboard reorder. */
export function templateFieldMoved(t: TemplateField[], fi: number, delta: number): TemplateField[] {
  const to = fi + delta;
  if (fi < 0 || fi >= t.length || to < 0 || to >= t.length) return t;
  const next = t.slice();
  const [moved] = next.splice(fi, 1);
  next.splice(to, 0, moved!);
  return templateConditionsRepaired(next);
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
  // `radio` is a choice type like `select` — both carry options.
  const isChoice = type === 'select' || type === 'radio';
  patch.options = isChoice ? (field.options?.length ? field.options : [{ value: '', label: '' }]) : undefined;
  if (type === 'agreement') {
    patch.mustAccept = field.mustAccept ?? true;
  } else {
    patch.terms = undefined;
    patch.termsFormat = undefined;
    patch.mustAccept = undefined;
  }
  if (type === 'address') patch.pii = true;
  // Retyping a field can strip its ability to be a condition source (or, for a
  // choice type, reset its options), so dependents are repaired in the same step.
  return templateConditionsRepaired(templateFieldSet(t, fi, patch));
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
  return templateConditionsRepaired(templateFieldSet(t, fi, { options }));
}

export function templateOptionRemoved(t: TemplateField[], fi: number, oi: number): TemplateField[] {
  const field = t[fi];
  if (!field) return t;
  return templateConditionsRepaired(templateFieldSet(t, fi, { options: (field.options ?? []).filter((_, idx) => idx !== oi) }));
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

export function withTemplateFieldLabelChanged(
  stages: ContestStage[],
  i: number,
  fi: number,
  label: string,
  lockedKeys?: ReadonlySet<string>,
): ContestStage[] {
  if (!stages[i]?.submissionTemplate?.[fi]) return stages;
  return withTemplate(stages, i, templateFieldLabelChanged(stages[i]!.submissionTemplate!, fi, label, lockedKeys));
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
  file: 'File upload',
  signature: 'Signature',
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
