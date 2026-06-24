/**
 * useContestEditor — the single form model behind the contest editor shell,
 * shared by BOTH the create and edit route shells (the ContestEditor orchestrator
 * passes `mode`). Extracted from the two divergent monolith pages so create ≡ edit:
 * one source of truth for the editable shape, slugging, date validation, dirty
 * tracking, and the POST/PUT save.
 *
 * Owns refs + functions + two reactive watchers (dirty + create-mode slug derive),
 * no component lifecycle hooks, so it unit-tests by calling it directly with a
 * stubbed `$fetch` and the context callbacks as spies (mirrors useDocsSiteSettings).
 *
 * Dates are stored as ISO instants (the canonical API shape); CpubDateTimeField
 * does the local-wall-clock conversion for the native picker, so there's no UTC
 * round-trip bug and no per-field re-conversion at save (the Phase 1 datetime fix).
 */
import { ref, computed, watch, nextTick, type Ref, type ComputedRef } from 'vue';
import type { ContestStage, ContestImageMeta } from '@commonpub/schema';
import type { ContestTemplateSeed } from '../utils/contestTemplates';

export type ContestFormat = 'markdown' | 'html';
export type ContestVisibility = 'public' | 'unlisted' | 'private';
export type ContestJudgingVisibility = 'public' | 'judges-only' | 'private';

/** A prize row in the editor (every field optional; filtered on save). */
export interface ContestPrizeRow {
  place: number | null;
  category: string;
  title: string;
  description: string;
  value: string;
}

/** A judging-criterion row (matches ContestCriteriaEditor's v-model shape). */
export interface ContestCriterionRow {
  label: string;
  weight?: number;
  description?: string;
}

/** The subset of a fetched contest the editor hydrates from (edit mode). */
export interface ContestEditorSource {
  title?: string | null;
  slug?: string | null;
  subheading?: string | null;
  description?: string | null;
  descriptionBlocks?: unknown[] | null;
  rulesBlocks?: unknown[] | null;
  prizesBlocks?: unknown[] | null;
  rules?: string | null;
  descriptionFormat?: string | null;
  rulesFormat?: string | null;
  prizesDescriptionFormat?: string | null;
  bannerUrl?: string | null;
  coverImageUrl?: string | null;
  bannerMeta?: ContestImageMeta | null;
  coverMeta?: ContestImageMeta | null;
  startDate?: string | null;
  endDate?: string | null;
  judgingEndDate?: string | null;
  communityVotingEnabled?: boolean | null;
  judgingVisibility?: string | null;
  eligibleContentTypes?: string[] | null;
  maxEntriesPerUser?: number | null;
  visibility?: string | null;
  visibleToRoles?: string[] | null;
  showPrizes?: boolean | null;
  stages?: ContestStage[] | null;
  currentStageId?: string | null;
  prizesDescription?: string | null;
  prizes?: { place?: number; category?: string; title?: string; description?: string; value?: string }[] | null;
  judgingCriteria?: { label: string; weight?: number; description?: string }[] | null;
}

export interface UseContestEditorOptions {
  mode: 'create' | 'edit';
  /** Current contest slug (edit mode; the `[slug]` route param). '' in create. */
  slug: () => string;
  /** Toast helper (kind maps to useToast().success / .error). */
  toast: (message: string, kind: 'success' | 'error') => void;
  /** Extract a human message from an API error (useApiError().extract). */
  extractError: (err: unknown) => string;
  /** Navigate to a path (navigateTo); the return is awaited but otherwise unused. */
  navigate: (path: string) => unknown;
  /** Re-fetch the contest after an edit save (edit mode only). */
  refresh?: () => Promise<void> | void;
  /**
   * Called (instead of `navigate`) when a SILENT save renames the slug, so the
   * orchestrator can swap the edit URL in place without leaving the editor (the
   * draft-autosave path). The next save targets `newSlug` via `opts.slug()`.
   */
  onRenamed?: (newSlug: string) => void;
}

export interface UseContestEditor {
  // form refs
  title: Ref<string>;
  slugInput: Ref<string>;
  slugTouched: Ref<boolean>;
  subheading: Ref<string>;
  description: Ref<string>;
  descriptionBlocks: Ref<unknown[] | null>;
  rulesBlocks: Ref<unknown[] | null>;
  prizesBlocks: Ref<unknown[] | null>;
  rules: Ref<string>;
  descriptionFormat: Ref<ContestFormat>;
  rulesFormat: Ref<ContestFormat>;
  prizesDescriptionFormat: Ref<ContestFormat>;
  bannerUrl: Ref<string>;
  coverImageUrl: Ref<string>;
  bannerMeta: Ref<ContestImageMeta | null>;
  coverMeta: Ref<ContestImageMeta | null>;
  startDate: Ref<string>;
  endDate: Ref<string>;
  judgingEndDate: Ref<string>;
  communityVotingEnabled: Ref<boolean>;
  judgingVisibility: Ref<ContestJudgingVisibility>;
  eligibleContentTypes: Ref<string[]>;
  maxEntriesPerUser: Ref<number | null>;
  visibility: Ref<ContestVisibility>;
  visibleToRoles: Ref<string[]>;
  showPrizes: Ref<boolean>;
  prizesDescription: Ref<string>;
  prizes: Ref<ContestPrizeRow[]>;
  criteria: Ref<ContestCriterionRow[]>;
  stages: Ref<ContestStage[]>;
  currentStageId: Ref<string | null>;
  // status
  saving: Ref<boolean>;
  formDirty: Ref<boolean>;
  dateError: ComputedRef<string>;
  canSubmit: ComputedRef<boolean>;
  // helpers
  slugify: (s: string) => string;
  toggleType: (type: string) => void;
  toggleRole: (role: string) => void;
  addPrize: () => void;
  removePrize: (index: number) => void;
  prizeLabel: (prize: ContestPrizeRow) => string;
  // lifecycle
  hydrate: (c: ContestEditorSource) => void;
  /** Seed a starter template (create mode) into the stage/rubric/body refs without
   *  marking the form dirty. Only the provided fields are applied. */
  applyTemplate: (seed: ContestTemplateSeed) => void;
  buildPayload: () => Record<string, unknown>;
  /** Persist the form. `silent` (autosave) skips the success toast + navigation +
   *  refresh, renames in place via `onRenamed`, and rethrows on failure so the
   *  caller's status machine can react. */
  save: (opts?: { silent?: boolean }) => Promise<void>;
}

export function slugifyContest(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+)|(-+$)/g, '').slice(0, 255);
}

function asFormat(v: string | null | undefined): ContestFormat {
  return v === 'html' ? 'html' : 'markdown';
}

export function useContestEditor(opts: UseContestEditorOptions): UseContestEditor {
  const title = ref('');
  const slugInput = ref('');
  // In create mode the slug auto-derives from the title until the operator edits
  // it; in edit mode it's seeded from the contest and never auto-derives.
  const slugTouched = ref(opts.mode === 'edit');
  const subheading = ref('');
  // Legacy plain-text body fields — no longer edited (the body is BlockTuple[]),
  // but kept on the model so an edit save round-trips them unchanged (back-compat).
  const description = ref('');
  const rules = ref('');
  const prizesDescription = ref('');
  const descriptionBlocks = ref<unknown[] | null>(null);
  const rulesBlocks = ref<unknown[] | null>(null);
  const prizesBlocks = ref<unknown[] | null>(null);
  const descriptionFormat = ref<ContestFormat>('markdown');
  const rulesFormat = ref<ContestFormat>('markdown');
  const prizesDescriptionFormat = ref<ContestFormat>('markdown');
  const bannerUrl = ref('');
  const coverImageUrl = ref('');
  const bannerMeta = ref<ContestImageMeta | null>(null);
  const coverMeta = ref<ContestImageMeta | null>(null);
  const startDate = ref('');
  const endDate = ref('');
  const judgingEndDate = ref('');
  const communityVotingEnabled = ref(false);
  const judgingVisibility = ref<ContestJudgingVisibility>('judges-only');
  const eligibleContentTypes = ref<string[]>([]);
  const maxEntriesPerUser = ref<number | null>(null);
  const visibility = ref<ContestVisibility>('public');
  const visibleToRoles = ref<string[]>([]);
  const showPrizes = ref(true);
  const prizes = ref<ContestPrizeRow[]>([]);
  const criteria = ref<ContestCriterionRow[]>([]);
  const stages = ref<ContestStage[]>([]);
  const currentStageId = ref<string | null>(null);

  const saving = ref(false);
  const formDirty = ref(false);
  // Suppress the dirty watcher while hydrate() bulk-populates the refs.
  let hydrating = false;

  const dateError = computed<string>(() => {
    if (startDate.value && endDate.value && new Date(endDate.value) <= new Date(startDate.value)) {
      return 'End date must be after the start date.';
    }
    if (judgingEndDate.value && endDate.value && new Date(judgingEndDate.value) < new Date(endDate.value)) {
      return 'Judging end date must be on or after the end date.';
    }
    return '';
  });

  // Create requires title + both dates up front; edit only enables Save once dirty.
  const canSubmit = computed<boolean>(() => {
    if (dateError.value) return false;
    if (opts.mode === 'create') return !!title.value.trim() && !!startDate.value && !!endDate.value;
    return !!title.value.trim() && formDirty.value;
  });

  function toggleType(type: string): void {
    const i = eligibleContentTypes.value.indexOf(type);
    if (i >= 0) eligibleContentTypes.value.splice(i, 1);
    else eligibleContentTypes.value.push(type);
  }
  function toggleRole(role: string): void {
    const i = visibleToRoles.value.indexOf(role);
    if (i >= 0) visibleToRoles.value.splice(i, 1);
    else visibleToRoles.value.push(role);
  }
  function addPrize(): void {
    prizes.value.push({ place: null, category: '', title: '', description: '', value: '' });
  }
  function removePrize(index: number): void {
    prizes.value.splice(index, 1);
  }
  function prizeLabel(prize: ContestPrizeRow): string {
    if (prize.category.trim()) return prize.category;
    if (prize.place && prize.place > 0) {
      const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
      return `${labels[prize.place - 1] || `${prize.place}th`} Place`;
    }
    // No place + no category: a flexible/description-only prize — don't invent a
    // placement (the old code labelled these "Nth Place" by row index).
    return 'Prize';
  }

  function hydrate(c: ContestEditorSource): void {
    hydrating = true;
    title.value = c.title ?? '';
    slugInput.value = c.slug ?? '';
    slugTouched.value = true;
    subheading.value = c.subheading ?? '';
    description.value = c.description ?? '';
    descriptionBlocks.value = c.descriptionBlocks ?? null;
    rulesBlocks.value = c.rulesBlocks ?? null;
    prizesBlocks.value = c.prizesBlocks ?? null;
    rules.value = c.rules ?? '';
    descriptionFormat.value = asFormat(c.descriptionFormat);
    rulesFormat.value = asFormat(c.rulesFormat);
    prizesDescriptionFormat.value = asFormat(c.prizesDescriptionFormat);
    bannerUrl.value = c.bannerUrl ?? '';
    coverImageUrl.value = c.coverImageUrl ?? '';
    bannerMeta.value = c.bannerMeta ?? null;
    coverMeta.value = c.coverMeta ?? null;
    // ISO instants stored verbatim; CpubDateTimeField renders them in local time.
    startDate.value = c.startDate ?? '';
    endDate.value = c.endDate ?? '';
    judgingEndDate.value = c.judgingEndDate ?? '';
    communityVotingEnabled.value = !!c.communityVotingEnabled;
    judgingVisibility.value = (c.judgingVisibility as ContestJudgingVisibility) ?? 'judges-only';
    eligibleContentTypes.value = [...(c.eligibleContentTypes ?? [])];
    maxEntriesPerUser.value = c.maxEntriesPerUser ?? null;
    visibility.value = (c.visibility as ContestVisibility) ?? 'public';
    visibleToRoles.value = [...(c.visibleToRoles ?? [])];
    showPrizes.value = c.showPrizes !== false;
    stages.value = Array.isArray(c.stages) ? [...c.stages] : [];
    currentStageId.value = c.currentStageId ?? null;
    prizesDescription.value = c.prizesDescription ?? '';
    prizes.value = (c.prizes ?? []).map((p) => ({
      place: p.place ?? null,
      category: p.category ?? '',
      title: p.title ?? '',
      description: p.description ?? '',
      value: p.value ?? '',
    }));
    criteria.value = (c.judgingCriteria ?? []).map((cr) => ({
      label: cr.label,
      weight: cr.weight ?? undefined,
      description: cr.description ?? undefined,
    }));
    formDirty.value = false;
    // Re-arm dirty tracking once this hydration's reactive effects have settled.
    void nextTick(() => { hydrating = false; });
  }

  // Seed a starter template into the stage/rubric/body refs (create mode). Guarded
  // by `hydrating` so an untouched template doesn't flip `formDirty` — a freshly
  // seeded create page should read "no unsaved changes". The orchestrator reseeds
  // the body block editors afterward (their own `syncingBodies` guard suppresses the
  // write-back), so seeding the body refs here is enough.
  function applyTemplate(seed: ContestTemplateSeed): void {
    hydrating = true;
    stages.value = seed.stages;
    currentStageId.value = seed.currentStageId;
    criteria.value = seed.judgingCriteria.map((cr) => ({
      label: cr.label,
      weight: cr.weight ?? undefined,
      description: cr.description ?? undefined,
    }));
    descriptionBlocks.value = seed.descriptionBlocks;
    rulesBlocks.value = seed.rulesBlocks;
    prizesBlocks.value = seed.prizesBlocks;
    formDirty.value = false;
    void nextTick(() => { hydrating = false; });
  }

  function buildPayload(): Record<string, unknown> {
    const prizeData = prizes.value
      .filter((p) => p.title.trim() || p.description.trim() || p.category.trim() || (typeof p.place === 'number' && p.place > 0))
      .map((p) => ({
        place: typeof p.place === 'number' && Number.isFinite(p.place) && p.place > 0 ? p.place : undefined,
        category: p.category.trim() || undefined,
        title: p.title.trim() || undefined,
        description: p.description.trim() || undefined,
        value: p.value.trim() || undefined,
      }));
    const criteriaData = criteria.value
      .filter((c) => c.label.trim())
      .map((c) => ({
        label: c.label.trim(),
        weight: typeof c.weight === 'number' && Number.isFinite(c.weight) ? c.weight : undefined,
        description: (c.description ?? '').trim() || undefined,
      }));
    return {
      title: title.value,
      slug: slugifyContest(slugInput.value) || undefined,
      subheading: subheading.value || undefined,
      description: description.value || undefined,
      descriptionBlocks: descriptionBlocks.value ?? undefined,
      rulesBlocks: rulesBlocks.value ?? undefined,
      prizesBlocks: prizesBlocks.value ?? undefined,
      rules: rules.value || undefined,
      descriptionFormat: descriptionFormat.value,
      rulesFormat: rulesFormat.value,
      prizesDescriptionFormat: prizesDescriptionFormat.value,
      bannerUrl: bannerUrl.value || undefined,
      coverImageUrl: coverImageUrl.value || undefined,
      // Clear the framing when the image is removed; else send it (or leave as-is).
      bannerMeta: bannerUrl.value ? (bannerMeta.value ?? undefined) : null,
      coverMeta: coverImageUrl.value ? (coverMeta.value ?? undefined) : null,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      judgingEndDate: judgingEndDate.value || undefined,
      communityVotingEnabled: communityVotingEnabled.value,
      judgingVisibility: judgingVisibility.value,
      eligibleContentTypes: eligibleContentTypes.value,
      maxEntriesPerUser: maxEntriesPerUser.value && maxEntriesPerUser.value > 0 ? maxEntriesPerUser.value : undefined,
      visibility: visibility.value,
      visibleToRoles: visibility.value === 'private' ? visibleToRoles.value : [],
      showPrizes: showPrizes.value,
      stages: stages.value,
      currentStageId: currentStageId.value ?? undefined,
      prizesDescription: prizesDescription.value || undefined,
      prizes: prizeData,
      judgingCriteria: criteriaData,
    };
  }

  async function save(saveOpts?: { silent?: boolean }): Promise<void> {
    const silent = saveOpts?.silent ?? false;
    if (dateError.value) { if (!silent) opts.toast(dateError.value, 'error'); return; }
    if (opts.mode === 'create' && (!title.value.trim() || !startDate.value || !endDate.value)) return;
    saving.value = true;
    try {
      if (opts.mode === 'create') {
        const result = await $fetch<{ slug: string }>('/api/contests', { method: 'POST', body: buildPayload() });
        if (!silent) opts.toast('Contest created', 'success');
        await opts.navigate(`/contests/${result.slug}`);
        return;
      }
      const fromSlug = opts.slug();
      const updated = await $fetch<{ slug: string }>(`/api/contests/${fromSlug}`, { method: 'PUT', body: buildPayload() });
      if (!silent) opts.toast('Contest updated', 'success');
      formDirty.value = false;
      // Slug changed -> the old URL no longer resolves. A manual save navigates to
      // the renamed contest's page; an autosave (silent) swaps the URL in place via
      // onRenamed so the organizer keeps editing without a jump.
      if (updated?.slug && updated.slug !== fromSlug) {
        if (silent) opts.onRenamed?.(updated.slug);
        else await opts.navigate(`/contests/${updated.slug}`);
        return;
      }
      if (!silent) await opts.refresh?.();
    } catch (err: unknown) {
      if (silent) throw err; // let the autosave status machine surface it
      opts.toast(opts.extractError(err), 'error');
    } finally {
      saving.value = false;
    }
  }

  // Any post-hydration edit flips the dirty flag (drives the topbar "unsaved" cue).
  watch(
    [title, slugInput, subheading, description, descriptionBlocks, rulesBlocks, prizesBlocks, rules,
      descriptionFormat, rulesFormat, prizesDescriptionFormat, bannerUrl, coverImageUrl, bannerMeta, coverMeta, startDate, endDate,
      judgingEndDate, communityVotingEnabled, judgingVisibility, eligibleContentTypes, maxEntriesPerUser,
      visibility, visibleToRoles, showPrizes, prizesDescription, prizes, criteria, stages, currentStageId],
    () => { if (!hydrating) formDirty.value = true; },
    { deep: true },
  );

  // Create mode: derive the slug from the title until the operator overrides it.
  if (opts.mode === 'create') {
    watch(title, (t) => { if (!slugTouched.value) slugInput.value = slugifyContest(t); });
  }

  return {
    title, slugInput, slugTouched, subheading, description, descriptionBlocks, rulesBlocks, prizesBlocks,
    rules, descriptionFormat, rulesFormat, prizesDescriptionFormat, bannerUrl, coverImageUrl, bannerMeta, coverMeta, startDate,
    endDate, judgingEndDate, communityVotingEnabled, judgingVisibility, eligibleContentTypes, maxEntriesPerUser,
    visibility, visibleToRoles, showPrizes, prizesDescription, prizes, criteria, stages, currentStageId,
    saving, formDirty, dateError, canSubmit,
    slugify: slugifyContest, toggleType, toggleRole, addPrize, removePrize, prizeLabel,
    hydrate, applyTemplate, buildPayload, save,
  };
}
