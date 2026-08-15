<script setup lang="ts">
/**
 * /admin/persona — the operator persona schema editor (plan 5.3.2, 5.4, 5.5, 8.5).
 *
 * Deliberately NOT `FormTemplateEditor.vue`, and deliberately not composed out
 * of extracted sub-components either. Plan section 14.4 defers that extraction:
 * a live contest is running on deveco and `FormTemplateEditor` is a controlled
 * component over `FormField[]` that emits a mandatory `required: boolean` plus
 * `pii`, which `personaFieldSchema` (`.strict()`) rejects outright. So this page
 * is self-contained: every sub-piece it needs is built inline, and no shared
 * component file is created that another surface could accidentally couple to.
 *
 * What this screen owns that the contest builder does not:
 *
 *  1. MACHINE KEYS ARE LOCKED (plan 5.5). The contest builder derives the key
 *     from the label and silently rewrites it on rename. In a persona that
 *     orphans EVERY user's rows for that field and drops the cohort to zero in
 *     analytics with no error anywhere. Here the key is read-only once the
 *     server has persisted it, a label rename never touches it, and the
 *     advanced unlock names the count it is about to discard.
 *  2. PRE-SAVE VALIDATION. The draft is run through `personaSectionsSchema`,
 *     the SAME schema the server enforces, on every edit. A choice field with a
 *     blank option is flagged inline and named in the summary instead of 400ing
 *     server-side with nothing marked in the form.
 *  3. PROVENANCE + REVERT (plan 5.3.2). `PUT /api/admin/features` merges and
 *     never removes, so a portal-touched flag can never be won back by the git
 *     file. Persona does not repeat that: the override banner is persistent and
 *     Revert calls the DELETE route.
 *  4. DRIFT (plan 5.3.1). A config-file edit bypasses every admin-route guard,
 *     so the reconciler's findings surface here with a per-field Purge or
 *     Retain control before those questions are counted again.
 *
 * Routes consumed (owned by the route agent, guarded by
 * `requirePermission('settings.manage')` plus `requireFeature('persona')`):
 *
 *   GET    /api/admin/persona/schema         -> AdminPersonaSchemaResponse
 *   PUT    /api/admin/persona/schema         -> { sections, removal }, If-Match: savedAt
 *   DELETE /api/admin/persona/schema         -> revert to commonpub.config.ts
 *   POST   /api/admin/persona/drift/:fieldKey-> { action: 'purge' | 'retain' }
 *
 * Every field the GET is not contractually required to return is OPTIONAL here,
 * and each absence has a stated degradation rather than a fabricated value:
 *
 *  - no `lockedKeys`: every key already in the loaded schema counts as
 *    persisted, which is the same rule stated conservatively;
 *  - no `platforms`: the built-in seven;
 *  - no `rowCounts` (the state today): the unlock confirmation says answers are
 *    discarded WITHOUT naming a number, rather than printing a zero nobody
 *    measured. The number is then learned from the PUT's own 409
 *    `PERSONA_SCHEMA_DESTRUCTIVE` blockers, which carry `affectedRows`, so
 *    after one refused save every confirmation names a real count. Adding
 *    `rowCounts` to the GET would name it on the first attempt and needs no
 *    change here.
 */
import {
  BUILTIN_PERSONA_LINK_PLATFORMS,
  PERSONA_FIELD_SPECS,
  PERSONA_FIELD_TYPES,
  type PersonaField,
  type PersonaFieldType,
  type PersonaFieldTypeSpec,
  type PersonaSection,
  isPersonaFieldAggregatable,
  personaFieldSpec,
  personaSectionsSchema,
} from '@commonpub/persona';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Persona Schema, Admin, ${useSiteName()}` });

// --- Wire shapes ----------------------------------------------------------------

/**
 * `PersonaSchemaDrift` from `@commonpub/server` carries `acknowledgedAt: Date`.
 * Over JSON that is a string, so the DTO is declared here rather than imported:
 * importing the server type would make the page claim a `Date` it never has.
 */
interface PersonaSchemaDriftDto {
  kind: 'missing_field' | 'type_changed' | 'sink_changed' | 'missing_option';
  fieldKey: string;
  detail: string;
  affectedRows: number;
  acknowledgedAt: string | null;
}

interface AdminPersonaSchemaResponse {
  /** Sections parsed out of `commonpub.config.ts`; null when the file declares none. */
  file: PersonaSection[] | null;
  /** Set when `config.persona` is present but malformed, so the operator sees why. */
  fileError?: string | null;
  /** The admin override document; null when the file (or the built-ins) win. */
  db: PersonaSection[] | null;
  effective: PersonaSection[];
  source: 'database' | 'config' | 'builtin';
  /** ISO timestamp of the override, and the `If-Match` token for the PUT. */
  savedAt: string | null;
  drift: PersonaSchemaDriftDto[];
  /**
   * Built-ins union file union DB, already resolved server-side. Only the key
   * and the label reach the wire, which is all a platform picker needs.
   */
  platforms?: Array<{ key: string; label: string }>;
  /** Field keys whose rows were kept after the field left the schema. */
  retired?: Array<{ fieldKey: string; retiredAt: string }>;
  /**
   * field key -> stored answer rows. NOT returned by the route today, so the
   * count that names the orphan risk is learned from a refused save instead.
   * Optional so a route that adds it needs no change here.
   */
  rowCounts?: Record<string, number>;
  /** Keys the server has stamped a lock record for. Optional. */
  lockedKeys?: string[];
}

/** `PUT` 400 `PERSONA_SCHEMA_INVALID`: one entry per offending field. */
interface PersonaSchemaFieldErrorDto {
  sectionIndex: number | null;
  sectionKey: string | null;
  fieldIndex: number | null;
  fieldKey: string | null;
  path: Array<string | number>;
  message: string;
}

/** `PUT` 409 `PERSONA_SCHEMA_DESTRUCTIVE`: what the save would discard. */
interface PersonaSchemaBlockerDto {
  fieldKey: string;
  kind:
    | 'field_removed'
    | 'type_changed'
    | 'column_changed'
    | 'sensitivity_changed'
    | 'sink_changed'
    | 'option_removed';
  detail: string;
  affectedRows: number;
  /** `force` clears it with ?force=true; `removal` needs a purge or retain choice. */
  requires: 'force' | 'removal';
}

// --- Draft model ----------------------------------------------------------------

/**
 * The draft wraps each field rather than adding properties to it. `PersonaField`
 * is validated by a `.strict()` schema, so a `_uid` or `_dirty` smuggled onto
 * the object would fail the save with an unrecognised-key error that points at
 * the editor rather than at anything the operator did.
 */
interface DraftField {
  uid: string;
  /** The key as the server last persisted it, or null for a field added here. */
  origKey: string | null;
  field: PersonaField;
}

interface DraftSection {
  uid: string;
  origKey: string | null;
  key: string;
  label: string;
  /** Round-trips `help`, `collapsedByDefault` and `order` untouched. */
  rest: Omit<PersonaSection, 'key' | 'label' | 'fields'>;
  fields: DraftField[];
}

type RemovalChoice = 'purge' | 'retain';

const toast = useToast();
const { persona: personaEnabled } = useFeatures();
const canManage = useCan('settings.manage');

const { data, refresh, pending } = useFetch<AdminPersonaSchemaResponse>(
  '/api/admin/persona/schema',
  { immediate: personaEnabled.value },
);

/**
 * ONE typed choke point for the response.
 *
 * `useFetch`'s own inference goes through the generated route types, and this
 * route lives in a sibling file the type generator has not seen when the page
 * is checked in isolation, which quietly hands back `any`. Re-annotating here
 * means every read below is checked against the DTO rather than waved through.
 */
const schema = computed<AdminPersonaSchemaResponse | null>(
  () => (data.value ?? null) as AdminPersonaSchemaResponse | null,
);

const draft = ref<DraftSection[]>([]);
const loadedSections = ref<PersonaSection[]>([]);
const unlocked = ref<Set<string>>(new Set());
const removalChoices = ref<Record<string, RemovalChoice>>({});
const collapsed = ref<Set<string>>(new Set());
const unlockPrompt = ref<string | null>(null);
const announcement = ref('');
const serverBlockers = ref<PersonaSchemaBlockerDto[]>([]);
const serverFieldErrors = ref<PersonaSchemaFieldErrorDto[]>([]);
const conflict = ref<{ clientSavedAt: string | null; serverSavedAt: string | null } | null>(null);
const saving = ref(false);
const reverting = ref(false);
const driftBusy = ref<string | null>(null);
const showExport = ref(false);

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `pf${uidSeq}`;
}

/**
 * Copy a field property by property. Two jobs: deep-clone so editing the draft
 * cannot mutate the fetched payload, and drop anything the server sent that is
 * not part of `personaFieldSchema`, which is what keeps `.strict()` happy.
 */
function cloneField(f: PersonaField): PersonaField {
  const out: PersonaField = { key: f.key, label: f.label, type: f.type };
  if (f.help !== undefined) out.help = f.help;
  if (f.maxLength !== undefined) out.maxLength = f.maxLength;
  if (f.options !== undefined) out.options = f.options.map((o) => ({ value: o.value, label: o.label }));
  if (f.maxSelections !== undefined) out.maxSelections = f.maxSelections;
  if (f.platform !== undefined) out.platform = f.platform;
  if (f.points !== undefined) out.points = f.points;
  if (f.pointsPerSelection !== undefined) out.pointsPerSelection = f.pointsPerSelection;
  if (f.analytics !== undefined) out.analytics = f.analytics;
  if (f.sensitive !== undefined) out.sensitive = f.sensitive;
  if (f.showOnProfile !== undefined) out.showOnProfile = f.showOnProfile;
  if (f.column !== undefined) out.column = f.column;
  return out;
}

function toDraftSection(section: PersonaSection, saved: boolean): DraftSection {
  const rest: Omit<PersonaSection, 'key' | 'label' | 'fields'> = {};
  if (section.help !== undefined) rest.help = section.help;
  if (section.collapsedByDefault !== undefined) rest.collapsedByDefault = section.collapsedByDefault;
  if (section.order !== undefined) rest.order = section.order;
  return {
    uid: nextUid(),
    origKey: saved ? section.key : null,
    key: section.key,
    label: section.label,
    rest,
    fields: section.fields.map((f) => ({
      uid: nextUid(),
      origKey: saved ? f.key : null,
      field: cloneField(f),
    })),
  };
}

function toSection(ds: DraftSection): PersonaSection {
  return { key: ds.key, label: ds.label, ...ds.rest, fields: ds.fields.map((df) => df.field) };
}

/** The plain document: what gets validated, saved and exported. */
const draftSections = computed<PersonaSection[]>(() => draft.value.map(toSection));

function seed(res: AdminPersonaSchemaResponse | null): void {
  if (!res) return;
  loadedSections.value = res.effective.map((s) => toSection(toDraftSection(s, true)));
  draft.value = res.effective.map((s) => toDraftSection(s, true));
  unlocked.value = new Set();
  removalChoices.value = {};
  unlockPrompt.value = null;
  collapsed.value = new Set(
    res.effective.filter((s) => s.collapsedByDefault === true).map((s) => s.key),
  );
}

// A draft is mutable by definition, so it cannot be a `computed` off the fetch.
// This is the navigation.vue seeding pattern, not the hydration antipattern:
// nothing here is rendered as a number before the fetch resolves.
watch(schema, (val) => seed(val), { immediate: true });

// --- Provenance -----------------------------------------------------------------

const source = computed<AdminPersonaSchemaResponse['source']>(() => schema.value?.source ?? 'builtin');
const hasOverride = computed(() => source.value === 'database');
const savedAt = computed<string | null>(() => schema.value?.savedAt ?? null);

function sameSection(a: PersonaSection | undefined, b: PersonaSection | undefined): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function fileSection(key: string): PersonaSection | undefined {
  const file = schema.value?.file;
  return file ? file.find((s) => s.key === key) : undefined;
}

function loadedSection(key: string): PersonaSection | undefined {
  return loadedSections.value.find((s) => s.key === key);
}

/** Per-section provenance badge (plan 5.3.2). */
function provenance(ds: DraftSection): string {
  const current = toSection(ds);
  const loaded = ds.origKey === null ? undefined : loadedSection(ds.origKey);
  if (!loaded) return 'Added here, not saved';
  if (!sameSection(current, loaded)) return 'Edited, not saved';
  if (source.value === 'config') return 'from commonpub.config.ts';
  if (source.value === 'builtin') return 'built in';
  // A DB override is in force: say whether this section still matches the file.
  return sameSection(current, fileSection(ds.key)) ? 'matches commonpub.config.ts' : 'overridden here';
}

function provenanceTone(ds: DraftSection): string {
  const text = provenance(ds);
  if (text === 'overridden here') return 'cpub-persona-badge--override';
  if (text.endsWith('not saved')) return 'cpub-persona-badge--dirty';
  return 'cpub-persona-badge--file';
}

// --- Locking (plan 5.5) ---------------------------------------------------------

const reportedLocks = computed<Set<string> | null>(() =>
  schema.value?.lockedKeys ? new Set(schema.value.lockedKeys) : null,
);

/**
 * A key is locked once the server has persisted it. When the route does not
 * report `lockedKeys`, every key that was already in the loaded schema counts as
 * persisted, which is the same rule stated conservatively.
 */
function isLocked(df: DraftField): boolean {
  if (df.origKey === null) return false;
  if (unlocked.value.has(df.uid)) return false;
  const reported = reportedLocks.value;
  return reported === null ? true : reported.has(df.origKey);
}

/**
 * Row counts the server told us about while REFUSING a save. `PUT` answers a
 * destructive change with 409 `PERSONA_SCHEMA_DESTRUCTIVE` and every blocker
 * carries its `affectedRows`, so the number the confirmation needs is learned
 * from the server rather than guessed. They are kept across edits because a
 * count is a fact about stored data, not about the draft.
 */
const learnedRows = ref<Record<string, number>>({});

/**
 * Stored rows for a key, or null when nothing has reported them.
 *
 * Null is deliberately not zero. Printing "0 stored answers" for a count nobody
 * measured is the false-zero class: the operator would read "nothing to lose"
 * off a number the page invented.
 */
function storedRows(key: string | null): number | null {
  if (key === null) return null;
  const reported = schema.value?.rowCounts?.[key];
  if (reported !== undefined) return reported;
  const learned = learnedRows.value[key];
  return learned === undefined ? null : learned;
}

function rowsPhrase(n: number): string {
  return n === 1 ? '1 stored answer' : `${n} stored answers`;
}

/** The confirmation copy plan 5.5 requires: it NAMES THE COUNT. */
function unlockCopy(df: DraftField): string {
  const rows = storedRows(df.origKey);
  if (rows === null) return 'Change the machine key? Any answers already stored for this question are discarded.';
  if (rows === 0) return 'Change the machine key? No answers are stored for this question yet.';
  return `Change the machine key? This discards ${rowsPhrase(rows)}.`;
}

function askUnlock(df: DraftField): void {
  unlockPrompt.value = df.uid;
}

function confirmUnlock(df: DraftField): void {
  const next = new Set(unlocked.value);
  next.add(df.uid);
  unlocked.value = next;
  unlockPrompt.value = null;
  // The operator has just been told the key change discards the stored answers,
  // so purge is the decision they agreed to. They can still switch it to Retain
  // in the removed-questions panel before saving.
  if (df.origKey !== null) removalChoices.value = { ...removalChoices.value, [df.origKey]: 'purge' };
}

// --- Editing --------------------------------------------------------------------

function patchField(df: DraftField, patch: Partial<PersonaField>): void {
  const next = { ...df.field } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  df.field = next as unknown as PersonaField;
}

function setFieldKey(df: DraftField, value: string): void {
  patchField(df, { key: value });
}

function setFieldLabel(df: DraftField, value: string): void {
  // The key is NEVER derived from the label. This one line is the whole of
  // plan 5.5's first rule.
  patchField(df, { label: value });
}

function suggestKey(df: DraftField): void {
  const suggestion = df.field.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (suggestion) setFieldKey(df, suggestion);
}

function changeType(df: DraftField, type: PersonaFieldType): void {
  const spec = personaFieldSpec(type);
  const prev = df.field;
  const next: PersonaField = { key: prev.key, label: prev.label, type };
  if (prev.help !== undefined) next.help = prev.help;
  if (prev.sensitive !== undefined) next.sensitive = prev.sensitive;
  if (prev.showOnProfile !== undefined) next.showOnProfile = prev.showOnProfile;
  if (prev.column !== undefined) next.column = prev.column;
  if (prev.points !== undefined) next.points = prev.points;
  if (spec.supportsMaxLength && prev.maxLength !== undefined) next.maxLength = prev.maxLength;
  if (spec.supportsMaxSelections) {
    if (prev.maxSelections !== undefined) next.maxSelections = prev.maxSelections;
    if (prev.pointsPerSelection !== undefined) next.pointsPerSelection = prev.pointsPerSelection;
  }
  if (spec.supportsOptions) {
    next.options = prev.options?.length
      ? prev.options.map((o) => ({ value: o.value, label: o.label }))
      : [{ value: 'option_1', label: 'Option 1' }];
  }
  if (type === 'link') next.platform = prev.platform ?? platforms.value[0]?.key ?? 'github';
  if (spec.sink === 'answers' && prev.analytics !== undefined) next.analytics = prev.analytics;
  df.field = next;
}

function setOption(df: DraftField, oi: number, patch: { value?: string; label?: string }): void {
  const options = (df.field.options ?? []).map((o, i) =>
    i === oi ? { value: patch.value ?? o.value, label: patch.label ?? o.label } : { ...o },
  );
  patchField(df, { options });
}

function addOption(df: DraftField): void {
  const options = [...(df.field.options ?? [])];
  options.push({ value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` });
  patchField(df, { options });
}

function removeOption(df: DraftField, oi: number): void {
  const options = (df.field.options ?? []).filter((_, i) => i !== oi);
  patchField(df, { options });
}

function setMaxLength(df: DraftField, raw: string): void {
  const n = Number.parseInt(raw, 10);
  patchField(df, { maxLength: Number.isFinite(n) && n > 0 ? n : undefined });
}

function setMaxSelections(df: DraftField, raw: string): void {
  const n = Number.parseInt(raw, 10);
  patchField(df, { maxSelections: Number.isFinite(n) && n > 0 ? n : undefined });
}

function addField(ds: DraftSection): void {
  ds.fields.push({
    uid: nextUid(),
    origKey: null,
    field: { key: '', label: 'New question', type: 'text' },
  });
}

function removeField(ds: DraftSection, fi: number): void {
  ds.fields.splice(fi, 1);
}

function addSection(): void {
  draft.value.push({
    uid: nextUid(),
    origKey: null,
    key: '',
    label: 'New section',
    rest: {},
    fields: [],
  });
}

function removeSection(si: number): void {
  draft.value.splice(si, 1);
}

function toggleCollapsed(key: string): void {
  const next = new Set(collapsed.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsed.value = next;
}

// --- Keyboard reorder with an aria-live position announcement --------------------

const moveButtons = new Map<string, HTMLButtonElement>();
function setMoveRef(id: string, el: unknown): void {
  if (el instanceof HTMLButtonElement) moveButtons.set(id, el);
  else moveButtons.delete(id);
}

function focusMove(id: string): void {
  void nextTick(() => {
    moveButtons.get(id)?.focus();
  });
}

function moveSection(si: number, delta: number): void {
  const to = si + delta;
  if (to < 0 || to >= draft.value.length) return;
  const arr = [...draft.value];
  const moved = arr[si]!;
  arr.splice(si, 1);
  arr.splice(to, 0, moved);
  draft.value = arr;
  announcement.value = `Moved section "${moved.label || 'section'}" to position ${to + 1} of ${arr.length}.`;
  focusMove(`s:${to}:${delta < 0 ? 'up' : 'down'}`);
}

function moveField(ds: DraftSection, fi: number, delta: number): void {
  const to = fi + delta;
  if (to < 0 || to >= ds.fields.length) return;
  const moved = ds.fields[fi]!;
  ds.fields.splice(fi, 1);
  ds.fields.splice(to, 0, moved);
  announcement.value = `Moved "${moved.field.label || 'question'}" to position ${to + 1} of ${ds.fields.length}.`;
  focusMove(`f:${ds.uid}:${to}:${delta < 0 ? 'up' : 'down'}`);
}

// --- Type picker, driven by the registry ----------------------------------------

const TYPE_GROUP_LABELS: Record<PersonaFieldTypeSpec['group'], string> = {
  basic: 'Basic',
  choice: 'Choice',
  links: 'Profile links',
  layout: 'Layout',
};

/**
 * Grouped straight off `PERSONA_FIELD_SPECS`, never a hand-written list, so a
 * type added to the registry appears here without a second edit.
 */
const typeGroups = computed<Array<{ group: string; types: PersonaFieldType[] }>>(() => {
  const byGroup = new Map<PersonaFieldTypeSpec['group'], PersonaFieldType[]>();
  for (const type of PERSONA_FIELD_TYPES) {
    const group = PERSONA_FIELD_SPECS[type].group;
    const list = byGroup.get(group);
    if (list) list.push(type);
    else byGroup.set(group, [type]);
  }
  return [...byGroup.entries()].map(([group, types]) => ({ group: TYPE_GROUP_LABELS[group], types }));
});

function typeLabel(type: PersonaFieldType): string {
  return PERSONA_FIELD_SPECS[type].label;
}

/**
 * The route resolves built-ins union file union DB itself, so this does NOT
 * merge again: a second merge here could disagree with the set the PUT
 * validates a `link` field's platform against, and the operator would be told a
 * platform exists that the save then rejects.
 */
const platforms = computed<Array<{ key: string; label: string }>>(
  () =>
    schema.value?.platforms
    ?? BUILTIN_PERSONA_LINK_PLATFORMS.map((p) => ({ key: p.key, label: p.label })),
);

function countedLabel(df: DraftField): string {
  return isPersonaFieldAggregatable(df.field) ? 'Counted in statistics' : 'Never counted';
}

// --- Pre-save validation --------------------------------------------------------

interface UiIssue {
  sectionIndex: number | null;
  fieldIndex: number | null;
  optionIndex: number | null;
  leaf: string | null;
  message: string;
}

function numberAt(path: ReadonlyArray<PropertyKey>, i: number): number | null {
  const seg = path[i];
  return typeof seg === 'number' ? seg : null;
}

/**
 * The SAME schema the server enforces. The UI never invents a second rule set:
 * it only re-words a handful of messages, so what the builder blocks and what
 * the PUT rejects cannot drift.
 */
const issues = computed<UiIssue[]>(() => {
  const parsed = personaSectionsSchema.safeParse(draftSections.value);
  if (parsed.success) return [];
  const seen = new Set<string>();
  const out: UiIssue[] = [];
  for (const issue of parsed.error.issues) {
    const path = issue.path;
    const sectionIndex = numberAt(path, 0);
    const fieldIndex = path[1] === 'fields' ? numberAt(path, 2) : null;
    const optionIndex = path[3] === 'options' ? numberAt(path, 4) : null;
    const last = path[path.length - 1];
    const leaf = typeof last === 'string' ? last : null;
    const ui: UiIssue = {
      sectionIndex,
      fieldIndex,
      optionIndex,
      leaf,
      message: humanize(issue.message, sectionIndex, fieldIndex, optionIndex, leaf),
    };
    // A blank string trips both `min(1)` and the pattern; show it once.
    const dedupe = `${sectionIndex}|${fieldIndex}|${optionIndex}|${leaf}|${ui.message}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(ui);
  }
  return out;
});

const MACHINE_KEY = /^[a-z0-9_]+$/;

function rawOptionValue(si: number | null, fi: number | null, oi: number | null): string | null {
  if (si === null || fi === null || oi === null) return null;
  return draft.value[si]?.fields[fi]?.field.options?.[oi]?.value ?? null;
}

function rawKey(si: number | null, fi: number | null): string | null {
  if (si === null) return null;
  if (fi === null) return draft.value[si]?.key ?? null;
  return draft.value[si]?.fields[fi]?.field.key ?? null;
}

/**
 * Re-word a handful of Zod messages, and ONLY those. Anything the humanizer does
 * not recognise falls through unchanged: a rewrite that swallowed "Duplicate
 * field key" would replace the one message an operator most needs with a
 * generic character-set complaint about a key that is perfectly well formed.
 */
function humanize(
  message: string,
  si: number | null,
  fi: number | null,
  oi: number | null,
  leaf: string | null,
): string {
  if (oi !== null && leaf === 'value') {
    const raw = rawOptionValue(si, fi, oi);
    if (raw !== null && raw.trim() === '') {
      return `Choice ${oi + 1} has no value. Give it a short value such as pcb.`;
    }
    if (raw !== null && !MACHINE_KEY.test(raw)) {
      return `Choice ${oi + 1} needs a value of lowercase letters, numbers or underscores.`;
    }
    return message;
  }
  if (leaf === 'key') {
    const raw = rawKey(si, fi);
    const what = fi === null ? 'section key' : 'machine key';
    if (raw !== null && raw.trim() === '') return `The ${what} cannot be empty.`;
    if (raw !== null && !MACHINE_KEY.test(raw)) {
      return `The ${what} must be lowercase letters, numbers or underscores.`;
    }
    return message;
  }
  if (leaf === 'label') {
    const label = oi !== null ? `Choice ${oi + 1}` : 'This';
    return `${label} needs a label.`;
  }
  return message;
}

function issuesFor(si: number, fi: number | null, oi: number | null): UiIssue[] {
  return issues.value.filter(
    (i) => i.sectionIndex === si && i.fieldIndex === fi && i.optionIndex === oi,
  );
}

/**
 * Any problem anywhere inside one field's card, including inside its options.
 * The card outline has to react to a bad option value too, or the operator sees
 * a summary naming a question and no marking on the question itself.
 */
function fieldHasIssue(si: number, fi: number): boolean {
  return issues.value.some((i) => i.sectionIndex === si && i.fieldIndex === fi);
}

function sectionLabelAt(si: number | null): string {
  if (si === null) return 'Schema';
  return draft.value[si]?.label || draft.value[si]?.key || `Section ${si + 1}`;
}

function fieldLabelAt(si: number | null, fi: number | null): string | null {
  if (si === null || fi === null) return null;
  const df = draft.value[si]?.fields[fi];
  if (!df) return null;
  return df.field.label || df.field.key || `Question ${fi + 1}`;
}

/** One line per problem, naming the section and the field it belongs to. */
const issueSummary = computed<string[]>(() =>
  issues.value.map((i) => {
    const field = fieldLabelAt(i.sectionIndex, i.fieldIndex);
    const where = field ? `${sectionLabelAt(i.sectionIndex)} / ${field}` : sectionLabelAt(i.sectionIndex);
    return `${where}: ${i.message}`;
  }),
);

// --- Removed questions (the PUT's `removal` map, plan 5.4) ----------------------

const draftKeys = computed<Set<string>>(
  () => new Set(draftSections.value.flatMap((s) => s.fields.map((f) => f.key))),
);

/** Every key the save drops, whether by deletion or by an unlocked key change. */
const droppedKeys = computed<string[]>(() => {
  const live = draftKeys.value;
  return loadedSections.value
    .flatMap((s) => s.fields.map((f) => f.key))
    .filter((key) => !live.has(key));
});

/**
 * Keys needing a purge-or-retain decision.
 *
 * Not just the dropped ones. The server also demands a decision for a `sink
 * changed` field, which is still IN the template: its rows now live in the
 * wrong table. Deriving this set from the dropped keys alone would leave the
 * operator staring at a 409 with no control to answer it.
 */
const removalKeys = computed<string[]>(() => {
  const keys = new Set(droppedKeys.value);
  for (const b of serverBlockers.value) {
    if (b.requires === 'removal') keys.add(b.fieldKey);
  }
  return [...keys];
});

const undecidedKeys = computed<string[]>(() =>
  removalKeys.value.filter((key) => removalChoices.value[key] === undefined),
);

function setRemoval(key: string, choice: RemovalChoice): void {
  removalChoices.value = { ...removalChoices.value, [key]: choice };
}

function removalCopy(key: string): string {
  const rows = storedRows(key);
  if (rows === null) return 'Stored answers for this question are not counted here.';
  if (rows === 0) return 'No answers are stored for this question.';
  return `${rowsPhrase(rows)}.`;
}

// --- Drift (plan 5.3.1) ---------------------------------------------------------

const DRIFT_KIND_LABEL: Record<PersonaSchemaDriftDto['kind'], string> = {
  missing_field: 'Question removed from the schema',
  type_changed: 'Answer type changed',
  sink_changed: 'Storage changed',
  missing_option: 'Choice removed',
};

/** Field keys whose answers were kept after the field left the schema. */
const retiredFields = computed<Array<{ fieldKey: string; retiredAt: string }>>(
  () => schema.value?.retired ?? [],
);

const openDrift = computed<PersonaSchemaDriftDto[]>(() =>
  (schema.value?.drift ?? []).filter((d) => d.acknowledgedAt === null),
);

async function resolveDrift(d: PersonaSchemaDriftDto, action: RemovalChoice): Promise<void> {
  driftBusy.value = `${d.fieldKey}:${d.kind}`;
  try {
    await $fetch(`/api/admin/persona/drift/${encodeURIComponent(d.fieldKey)}`, {
      method: 'POST',
      body: { action },
    });
    toast.success(
      action === 'purge'
        ? `Deleted the stored answers for ${d.fieldKey}`
        : `Kept the stored answers for ${d.fieldKey}`,
    );
    await refresh();
  } catch {
    toast.error('Could not resolve that difference');
  } finally {
    driftBusy.value = null;
  }
}

// --- Save, revert, export -------------------------------------------------------

const isDirty = computed(
  () => JSON.stringify(draftSections.value) !== JSON.stringify(loadedSections.value),
);

const blockedReason = computed<string | null>(() => {
  if (issues.value.length > 0) return 'Fix the problems listed above before saving.';
  if (undecidedKeys.value.length > 0) return 'Choose what happens to the removed questions before saving.';
  return null;
});

const canSave = computed(() => canManage.value && isDirty.value && blockedReason.value === null && !saving.value);

/** Blockers the server can only clear with an explicit ?force=true. */
const forceableBlockers = computed<PersonaSchemaBlockerDto[]>(() =>
  serverBlockers.value.filter((b) => b.requires === 'force'),
);

/**
 * h3 nests a handler's `data` one level deeper than it reads: a route throwing
 * `createError({ data: { code } })` arrives at the client as `err.data.data`.
 * Reading `err.data.code` instead is how every Zod error in this app once
 * rendered as the bare status message. The fallback covers a plain shape rather
 * than assuming one nesting for all time.
 */
function errorPayload(err: unknown): Record<string, unknown> {
  const e = err as { data?: { data?: unknown } } | null;
  const outer = e?.data;
  if (outer === undefined || outer === null || typeof outer !== 'object') return {};
  const inner = (outer as { data?: unknown }).data;
  if (inner !== undefined && inner !== null && typeof inner === 'object') {
    return inner as Record<string, unknown>;
  }
  return outer as Record<string, unknown>;
}

function readBlockers(payload: Record<string, unknown>): PersonaSchemaBlockerDto[] {
  const raw = payload.blockers;
  return Array.isArray(raw) ? (raw as PersonaSchemaBlockerDto[]) : [];
}

function readFieldErrors(payload: Record<string, unknown>): PersonaSchemaFieldErrorDto[] {
  const raw = payload.fieldErrors;
  return Array.isArray(raw) ? (raw as PersonaSchemaFieldErrorDto[]) : [];
}

async function save(force = false): Promise<void> {
  // The force retry deliberately bypasses `canSave`: it exists precisely to get
  // past a refusal, and the undecided-removal gate below still applies because
  // `force` never waives a purge-or-retain decision, server-side or here.
  if (!force && !canSave.value) return;
  if (!canManage.value || saving.value) return;
  if (undecidedKeys.value.length > 0) return;

  saving.value = true;
  serverBlockers.value = [];
  serverFieldErrors.value = [];
  conflict.value = null;
  try {
    const headers: Record<string, string> = {};
    if (savedAt.value) headers['If-Match'] = savedAt.value;
    await $fetch(`/api/admin/persona/schema${force ? '?force=true' : ''}`, {
      method: 'PUT',
      headers,
      body: { sections: draftSections.value, removal: removalChoices.value },
    });
    toast.success('Persona schema saved');
    await refresh();
  } catch (err) {
    const e = err as { statusCode?: number };
    const payload = errorPayload(err);
    const code = typeof payload.code === 'string' ? payload.code : null;

    if (code === 'PERSONA_SCHEMA_DESTRUCTIVE') {
      const blockers = readBlockers(payload);
      serverBlockers.value = blockers;
      // The counts arrive with the refusal, so every confirmation from here on
      // can name a real number instead of hedging.
      const learned = { ...learnedRows.value };
      for (const b of blockers) learned[b.fieldKey] = b.affectedRows;
      learnedRows.value = learned;
      toast.error('This save would discard stored answers. Choose what happens to each.');
    } else if (code === 'PERSONA_SCHEMA_CONFLICT') {
      conflict.value = {
        clientSavedAt: typeof payload.clientSavedAt === 'string' ? payload.clientSavedAt : null,
        serverSavedAt: typeof payload.serverSavedAt === 'string' ? payload.serverSavedAt : null,
      };
      toast.error('Someone else saved this schema while you were editing.');
    } else if (code === 'PERSONA_SCHEMA_INVALID') {
      serverFieldErrors.value = readFieldErrors(payload);
      toast.error(
        typeof payload.message === 'string' ? payload.message : 'The persona schema was rejected.',
      );
    } else {
      toast.error(
        e.statusCode === 403
          ? 'You do not have permission to change the persona schema.'
          : 'Could not save the persona schema',
      );
    }
  } finally {
    saving.value = false;
  }
}

/** Discard a refusal the moment the draft changes, so no stale blocker misleads. */
watch(draftSections, () => {
  serverBlockers.value = [];
  serverFieldErrors.value = [];
  conflict.value = null;
});

async function revert(): Promise<void> {
  if (typeof window !== 'undefined'
    && !window.confirm('Remove the admin edited schema and use commonpub.config.ts again?')) return;
  reverting.value = true;
  try {
    await $fetch('/api/admin/persona/schema', { method: 'DELETE' });
    toast.success('Reverted to commonpub.config.ts');
    await refresh();
  } catch {
    toast.error('Could not revert the persona schema');
  } finally {
    reverting.value = false;
  }
}

function discard(): void {
  seed(schema.value);
}

// --- "Export for commonpub.config.ts" -------------------------------------------

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Serialize to a TypeScript object literal, not JSON: this is meant to be pasted into source. */
function toTsLiteral(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${padInner}${toTsLiteral(v, indent + 1)}`);
    return `[\n${items.join(',\n')},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const body = entries.map(([k, v]) => {
      const key = IDENT.test(k) ? k : `'${k}'`;
      return `${padInner}${key}: ${toTsLiteral(v, indent + 1)}`;
    });
    return `{\n${body.join(',\n')},\n${pad}}`;
  }
  return 'undefined';
}

const exportSource = computed<string>(() => {
  const literal = toTsLiteral(draftSections.value, 2);
  return [
    "import { definePersonaSections } from '@commonpub/persona';",
    '',
    '// commonpub.config.ts',
    'export default defineCommonPubConfig({',
    '  persona: {',
    `    sections: definePersonaSections(${literal}),`,
    '  },',
    '});',
  ].join('\n');
});

function toggleExport(): void {
  showExport.value = !showExport.value;
}

async function copyExport(): Promise<void> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) {
    toast.error('Copying is not available here. Select the text and copy it.');
    return;
  }
  try {
    await clipboard.writeText(exportSource.value);
    toast.success('Copied for commonpub.config.ts');
  } catch {
    toast.error('Could not copy. Select the text and copy it.');
  }
}
</script>

<template>
  <div class="cpub-persona-admin">
    <div v-if="!personaEnabled" class="cpub-persona-off">
      <h1 class="cpub-persona-title">Persona</h1>
      <p class="cpub-persona-off-text">
        The persona schema is not enabled on this instance. Turn on the
        <NuxtLink to="/admin/features">Persona feature flag</NuxtLink> to edit it.
      </p>
    </div>

    <template v-else>
      <div class="cpub-persona-head">
        <div>
          <h1 class="cpub-persona-title">Persona Schema</h1>
          <p class="cpub-persona-subtitle">
            The questions people can answer about themselves. Every question is optional for them.
          </p>
        </div>
        <div class="cpub-persona-head-actions">
          <button type="button" class="cpub-btn cpub-btn-sm" :aria-expanded="showExport" @click="toggleExport">
            <i class="fa-solid fa-file-code"></i> Export for commonpub.config.ts
          </button>
          <button type="button" class="cpub-btn cpub-btn-sm" :disabled="!canManage" @click="addSection">
            <i class="fa-solid fa-plus"></i> Add section
          </button>
          <button type="button" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="!canSave" @click="save()">
            <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i> Save
          </button>
        </div>
      </div>

      <!-- Plan 5.3.2: persistent while a DB override exists, so nobody wonders
           why their committed config file has no effect. -->
      <div v-if="hasOverride" class="cpub-persona-banner cpub-persona-banner--override" role="status">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">
            This instance is using an admin edited persona schema. The version in commonpub.config.ts is not applied.
          </p>
          <p v-if="savedAt" class="cpub-persona-banner-meta">Saved {{ savedAt }}</p>
        </div>
        <button
          type="button"
          class="cpub-btn cpub-btn-sm cpub-persona-revert"
          :disabled="!canManage || reverting"
          @click="revert"
        >
          <i :class="reverting ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-rotate-left'"></i> Revert to the config file
        </button>
      </div>

      <div v-if="schema?.fileError" class="cpub-persona-banner cpub-persona-banner--error" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">commonpub.config.ts could not be read</p>
          <p class="cpub-persona-banner-meta">{{ schema.fileError }}</p>
        </div>
      </div>

      <!-- Plan 5.3.1: blocking, per field, and it never mutates anything by itself. -->
      <div v-if="openDrift.length" class="cpub-persona-banner cpub-persona-banner--drift" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">
            Some questions in the config file no longer match the answers already stored. Choose what to do with each before these questions are counted again.
          </p>
          <ul class="cpub-persona-drift-list">
            <li v-for="d in openDrift" :key="`${d.fieldKey}:${d.kind}`" class="cpub-persona-drift-row">
              <div class="cpub-persona-drift-info">
                <code class="cpub-persona-key">{{ d.fieldKey }}</code>
                <span class="cpub-persona-drift-kind">{{ DRIFT_KIND_LABEL[d.kind] }}</span>
                <span class="cpub-persona-drift-detail">{{ d.detail }}</span>
                <span class="cpub-persona-drift-rows">{{ rowsPhrase(d.affectedRows) }}</span>
              </div>
              <div class="cpub-persona-drift-actions">
                <button
                  type="button"
                  class="cpub-btn cpub-btn-sm"
                  :disabled="!canManage || driftBusy !== null"
                  @click="resolveDrift(d, 'retain')"
                >
                  Retain
                </button>
                <button
                  type="button"
                  class="cpub-btn cpub-btn-sm cpub-persona-danger"
                  :disabled="!canManage || driftBusy !== null"
                  @click="resolveDrift(d, 'purge')"
                >
                  Purge
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Pre-save validation. The contest builder has no equivalent, which is
           why a blank choice value there 400s with nothing marked in the form. -->
      <div v-if="issueSummary.length" class="cpub-persona-banner cpub-persona-banner--error" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">
            {{ issueSummary.length === 1 ? 'One problem to fix before saving' : `${issueSummary.length} problems to fix before saving` }}
          </p>
          <ul class="cpub-persona-issue-list">
            <li v-for="(line, li) in issueSummary" :key="li">{{ line }}</li>
          </ul>
        </div>
      </div>

      <!-- The PUT's `removal` map (plan 5.4): every dropped key needs a decision. -->
      <div v-if="removalKeys.length" class="cpub-persona-banner cpub-persona-banner--drift">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">Removed questions</p>
          <p class="cpub-persona-banner-meta">
            These questions are no longer in the schema. Choose what happens to the answers people already gave.
          </p>
          <fieldset v-for="key in removalKeys" :key="key" class="cpub-persona-removal">
            <legend class="cpub-persona-removal-legend">
              <code class="cpub-persona-key">{{ key }}</code>
              <span class="cpub-persona-removal-count">{{ removalCopy(key) }}</span>
            </legend>
            <label class="cpub-persona-radio">
              <input
                type="radio"
                :name="`removal-${key}`"
                value="retain"
                :checked="removalChoices[key] === 'retain'"
                @change="setRemoval(key, 'retain')"
              />
              <span>Keep the answers</span>
            </label>
            <label class="cpub-persona-radio">
              <input
                type="radio"
                :name="`removal-${key}`"
                value="purge"
                :checked="removalChoices[key] === 'purge'"
                @change="setRemoval(key, 'purge')"
              />
              <span>Delete the answers</span>
            </label>
          </fieldset>
        </div>
      </div>

      <!-- The server refused the save because it would discard stored answers.
           Every blocker carries its own row count, so the confirmation names a
           real number rather than asking "are you sure?" about an unknown. -->
      <div v-if="serverBlockers.length" class="cpub-persona-banner cpub-persona-banner--error" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">This save would discard stored answers</p>
          <ul class="cpub-persona-issue-list">
            <li v-for="(b, bi) in serverBlockers" :key="bi">{{ b.detail }}</li>
          </ul>
          <div v-if="forceableBlockers.length" class="cpub-persona-confirm-actions cpub-persona-blocker-actions">
            <button type="button" class="cpub-btn cpub-btn-sm" @click="discard">
              Undo my changes
            </button>
            <button
              type="button"
              class="cpub-btn cpub-btn-sm cpub-persona-danger"
              :disabled="!canManage || saving || undecidedKeys.length > 0"
              @click="save(true)"
            >
              Save anyway and discard them
            </button>
          </div>
        </div>
      </div>

      <!-- Per-field errors the client-side schema cannot know about, such as a
           link platform this instance does not declare. -->
      <div v-if="serverFieldErrors.length" class="cpub-persona-banner cpub-persona-banner--error" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">The server rejected this schema</p>
          <ul class="cpub-persona-issue-list">
            <li v-for="(fe, fei) in serverFieldErrors" :key="fei">
              <template v-if="fe.sectionKey || fe.fieldKey">
                {{ [fe.sectionKey, fe.fieldKey].filter(Boolean).join(' / ') }}:
              </template>
              {{ fe.message }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="conflict" class="cpub-persona-banner cpub-persona-banner--error" role="alert">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">
            Someone else saved this schema while you were editing.
          </p>
          <p class="cpub-persona-banner-meta">
            You loaded {{ conflict.clientSavedAt ?? 'no saved version' }}. The server now has
            {{ conflict.serverSavedAt ?? 'no saved version' }}. Reload to see theirs, and your
            unsaved changes are lost.
          </p>
        </div>
      </div>

      <!-- Retained data from questions that have left the schema (plan 4.6). -->
      <div v-if="retiredFields.length" class="cpub-persona-banner">
        <div class="cpub-persona-banner-body">
          <p class="cpub-persona-banner-title">Data kept from removed questions</p>
          <p class="cpub-persona-banner-meta">
            These answers are still stored and are never counted in statistics. People can delete
            their own copy from their profile settings.
          </p>
          <ul class="cpub-persona-issue-list">
            <li v-for="r in retiredFields" :key="r.fieldKey">
              <code class="cpub-persona-key">{{ r.fieldKey }}</code> kept since {{ r.retiredAt }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="showExport" class="cpub-persona-export">
        <div class="cpub-persona-export-head">
          <span class="cpub-form-label">Paste this into commonpub.config.ts</span>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="copyExport">
            <i class="fa-solid fa-copy"></i> Copy
          </button>
        </div>
        <p class="cpub-form-hint">
          Commit it, deploy, then press Revert so the file is the one that counts.
        </p>
        <textarea
          class="cpub-form-input cpub-persona-export-text"
          rows="14"
          readonly
          spellcheck="false"
          aria-label="Persona schema as TypeScript for commonpub.config.ts"
          :value="exportSource"
        ></textarea>
      </div>

      <!-- Reorder announcements. Polite, never assertive. -->
      <div class="cpub-sr-only" aria-live="polite">{{ announcement }}</div>

      <p v-if="pending && !draft.length" class="cpub-persona-empty">Loading the persona schema.</p>
      <p v-else-if="!draft.length" class="cpub-persona-empty">
        No sections yet. Add one to start describing the people on this instance.
      </p>

      <section v-for="(ds, si) in draft" :key="ds.uid" class="cpub-persona-section">
        <div class="cpub-persona-section-head">
          <div class="cpub-persona-reorder" role="group" :aria-label="`Reorder section ${ds.label || ds.key}`">
            <button
              :ref="(el) => setMoveRef(`s:${si}:up`, el)"
              type="button"
              class="cpub-persona-iconbtn"
              :disabled="si === 0"
              :aria-label="`Move section ${ds.label || ds.key} up`"
              @click="moveSection(si, -1)"
            >
              <i class="fa-solid fa-chevron-up"></i>
            </button>
            <button
              :ref="(el) => setMoveRef(`s:${si}:down`, el)"
              type="button"
              class="cpub-persona-iconbtn"
              :disabled="si === draft.length - 1"
              :aria-label="`Move section ${ds.label || ds.key} down`"
              @click="moveSection(si, 1)"
            >
              <i class="fa-solid fa-chevron-down"></i>
            </button>
          </div>

          <button
            type="button"
            class="cpub-persona-disclosure"
            :aria-expanded="!collapsed.has(ds.key)"
            :aria-controls="`persona-section-${si}`"
            @click="toggleCollapsed(ds.key)"
          >
            <i :class="collapsed.has(ds.key) ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'"></i>
            <span class="cpub-persona-section-name">{{ ds.label || 'Untitled section' }}</span>
            <span class="cpub-persona-section-count">{{ ds.fields.length }} questions</span>
          </button>

          <span class="cpub-persona-badge" :class="provenanceTone(ds)">{{ provenance(ds) }}</span>

          <button
            type="button"
            class="cpub-persona-iconbtn cpub-persona-danger"
            :aria-label="`Remove section ${ds.label || ds.key}`"
            :disabled="!canManage"
            @click="removeSection(si)"
          >
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <div v-show="!collapsed.has(ds.key)" :id="`persona-section-${si}`" class="cpub-persona-section-body">
          <div class="cpub-persona-grid">
            <div class="cpub-persona-control">
              <label class="cpub-form-label" :for="`section-label-${si}`">Section title</label>
              <input
                :id="`section-label-${si}`"
                v-model="ds.label"
                type="text"
                class="cpub-form-input"
                :aria-describedby="`section-label-help-${si}`"
              />
              <p :id="`section-label-help-${si}`" class="cpub-form-hint">Shown as the heading on the persona editor.</p>
            </div>
            <div class="cpub-persona-control">
              <label class="cpub-form-label" :for="`section-key-${si}`">Section key</label>
              <input
                :id="`section-key-${si}`"
                v-model="ds.key"
                type="text"
                class="cpub-form-input cpub-persona-mono"
                :aria-describedby="`section-key-help-${si}`"
              />
              <p :id="`section-key-help-${si}`" class="cpub-form-hint">Lowercase letters, numbers and underscores.</p>
              <p v-for="(iss, ii) in issuesFor(si, null, null)" :key="ii" class="cpub-persona-error">{{ iss.message }}</p>
            </div>
          </div>

          <div
            v-for="(df, fi) in ds.fields"
            :key="df.uid"
            class="cpub-persona-field"
            :class="{ 'cpub-persona-field--invalid': fieldHasIssue(si, fi) }"
          >
            <div class="cpub-persona-reorder" role="group" :aria-label="`Reorder ${df.field.label || 'question'}`">
              <button
                :ref="(el) => setMoveRef(`f:${ds.uid}:${fi}:up`, el)"
                type="button"
                class="cpub-persona-iconbtn"
                :disabled="fi === 0"
                :aria-label="`Move ${df.field.label || 'question'} up`"
                @click="moveField(ds, fi, -1)"
              >
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <button
                :ref="(el) => setMoveRef(`f:${ds.uid}:${fi}:down`, el)"
                type="button"
                class="cpub-persona-iconbtn"
                :disabled="fi === ds.fields.length - 1"
                :aria-label="`Move ${df.field.label || 'question'} down`"
                @click="moveField(ds, fi, 1)"
              >
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>

            <div class="cpub-persona-field-body">
              <div class="cpub-persona-grid">
                <div class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-label-${si}-${fi}`">Question</label>
                  <input
                    :id="`field-label-${si}-${fi}`"
                    type="text"
                    class="cpub-form-input"
                    :value="df.field.label"
                    :aria-describedby="`field-label-help-${si}-${fi}`"
                    @input="setFieldLabel(df, ($event.target as HTMLInputElement).value)"
                  />
                  <p :id="`field-label-help-${si}-${fi}`" class="cpub-form-hint">
                    Renaming this never changes the machine key.
                  </p>
                </div>

                <div class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-type-${si}-${fi}`">Answer type</label>
                  <select
                    :id="`field-type-${si}-${fi}`"
                    class="cpub-form-input"
                    :value="df.field.type"
                    :aria-describedby="`field-type-help-${si}-${fi}`"
                    @change="changeType(df, ($event.target as HTMLSelectElement).value as PersonaFieldType)"
                  >
                    <optgroup v-for="g in typeGroups" :key="g.group" :label="g.group">
                      <option v-for="t in g.types" :key="t" :value="t">{{ typeLabel(t) }}</option>
                    </optgroup>
                  </select>
                  <p :id="`field-type-help-${si}-${fi}`" class="cpub-form-hint">{{ countedLabel(df) }}.</p>
                </div>

                <div class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-key-${si}-${fi}`">Machine key</label>
                  <input
                    :id="`field-key-${si}-${fi}`"
                    type="text"
                    class="cpub-form-input cpub-persona-mono"
                    :value="df.field.key"
                    :readonly="isLocked(df)"
                    :aria-readonly="isLocked(df)"
                    :aria-describedby="`field-key-help-${si}-${fi}`"
                    @input="setFieldKey(df, ($event.target as HTMLInputElement).value)"
                  />
                  <p :id="`field-key-help-${si}-${fi}`" class="cpub-form-hint">
                    <template v-if="isLocked(df)">
                      Locked. This key is how every stored answer is addressed.
                    </template>
                    <template v-else-if="df.origKey === null">
                      Lowercase letters, numbers and underscores. It cannot be changed after saving.
                    </template>
                    <template v-else>
                      Unlocked. Saving a different key orphans the answers stored under
                      <code>{{ df.origKey }}</code>.
                    </template>
                  </p>
                  <div class="cpub-persona-key-actions">
                    <button
                      v-if="isLocked(df)"
                      type="button"
                      class="cpub-btn cpub-btn-sm"
                      :disabled="!canManage"
                      @click="askUnlock(df)"
                    >
                      <i class="fa-solid fa-unlock"></i> Change the key
                    </button>
                    <button
                      v-if="df.origKey === null"
                      type="button"
                      class="cpub-btn cpub-btn-sm"
                      @click="suggestKey(df)"
                    >
                      Suggest from the question
                    </button>
                  </div>
                  <p v-for="(iss, ii) in issuesFor(si, fi, null)" :key="ii" class="cpub-persona-error">{{ iss.message }}</p>
                </div>
              </div>

              <!-- The advanced unlock. Plan 5.5 requires the confirmation to name
                   the count, so the operator is never told "are you sure?" about
                   a number they cannot see. -->
              <div
                v-if="unlockPrompt === df.uid"
                class="cpub-persona-confirm"
                role="alertdialog"
                :aria-label="`Change the machine key for ${df.field.label || df.field.key}`"
              >
                <p class="cpub-persona-confirm-text">{{ unlockCopy(df) }}</p>
                <div class="cpub-persona-confirm-actions">
                  <button type="button" class="cpub-btn cpub-btn-sm" @click="unlockPrompt = null">
                    Keep the key
                  </button>
                  <button type="button" class="cpub-btn cpub-btn-sm cpub-persona-danger" @click="confirmUnlock(df)">
                    Change the key anyway
                  </button>
                </div>
              </div>

              <div class="cpub-persona-control">
                <label class="cpub-form-label" :for="`field-help-${si}-${fi}`">Help text</label>
                <input
                  :id="`field-help-${si}-${fi}`"
                  type="text"
                  class="cpub-form-input"
                  :value="df.field.help ?? ''"
                  placeholder="Shown under the question (optional)"
                  @input="patchField(df, { help: ($event.target as HTMLInputElement).value || undefined })"
                />
              </div>

              <!-- Choice options, with the unique-value rule enforced before the save. -->
              <div v-if="PERSONA_FIELD_SPECS[df.field.type].supportsOptions" class="cpub-persona-options">
                <span class="cpub-form-label">Choices</span>
                <div v-for="(opt, oi) in (df.field.options ?? [])" :key="oi" class="cpub-persona-option-row">
                  <input
                    type="text"
                    class="cpub-form-input"
                    :value="opt.label"
                    placeholder="Label"
                    :aria-label="`${df.field.label || 'Question'} choice ${oi + 1} label`"
                    @input="setOption(df, oi, { label: ($event.target as HTMLInputElement).value })"
                  />
                  <input
                    type="text"
                    class="cpub-form-input cpub-persona-mono"
                    :value="opt.value"
                    placeholder="Value"
                    :aria-label="`${df.field.label || 'Question'} choice ${oi + 1} value`"
                    :aria-invalid="issuesFor(si, fi, oi).length > 0"
                    @input="setOption(df, oi, { value: ($event.target as HTMLInputElement).value })"
                  />
                  <button
                    type="button"
                    class="cpub-persona-iconbtn cpub-persona-danger"
                    :aria-label="`Remove choice ${oi + 1}`"
                    @click="removeOption(df, oi)"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                  <p v-for="(iss, ii) in issuesFor(si, fi, oi)" :key="ii" class="cpub-persona-error cpub-persona-error--option">
                    {{ iss.message }}
                  </p>
                </div>
                <button type="button" class="cpub-btn cpub-btn-sm" @click="addOption(df)">
                  <i class="fa-solid fa-plus"></i> Add choice
                </button>
              </div>

              <div class="cpub-persona-grid">
                <div v-if="PERSONA_FIELD_SPECS[df.field.type].supportsMaxLength" class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-maxlen-${si}-${fi}`">Maximum length</label>
                  <input
                    :id="`field-maxlen-${si}-${fi}`"
                    type="number"
                    min="1"
                    max="2000"
                    class="cpub-form-input"
                    :value="df.field.maxLength ?? ''"
                    @input="setMaxLength(df, ($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div v-if="PERSONA_FIELD_SPECS[df.field.type].supportsMaxSelections" class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-maxsel-${si}-${fi}`">Maximum selections</label>
                  <input
                    :id="`field-maxsel-${si}-${fi}`"
                    type="number"
                    min="1"
                    max="64"
                    class="cpub-form-input"
                    :value="df.field.maxSelections ?? ''"
                    @input="setMaxSelections(df, ($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div v-if="df.field.type === 'link'" class="cpub-persona-control">
                  <label class="cpub-form-label" :for="`field-platform-${si}-${fi}`">Platform</label>
                  <select
                    :id="`field-platform-${si}-${fi}`"
                    class="cpub-form-input"
                    :value="df.field.platform ?? ''"
                    @change="patchField(df, { platform: ($event.target as HTMLSelectElement).value })"
                  >
                    <option v-for="p in platforms" :key="p.key" :value="p.key">{{ p.label }}</option>
                  </select>
                </div>
              </div>

              <div class="cpub-persona-toggles">
                <label class="cpub-persona-check">
                  <input
                    type="checkbox"
                    :checked="df.field.sensitive === true"
                    :aria-label="`${df.field.label || 'Question'} is sensitive`"
                    @change="patchField(df, { sensitive: ($event.target as HTMLInputElement).checked || undefined })"
                  />
                  <span>Sensitive. Never counted, stored as free text.</span>
                </label>
                <label v-if="PERSONA_FIELD_SPECS[df.field.type].aggregatable" class="cpub-persona-check">
                  <input
                    type="checkbox"
                    :checked="df.field.analytics !== false"
                    :aria-label="`${df.field.label || 'Question'} can be counted`"
                    @change="patchField(df, { analytics: ($event.target as HTMLInputElement).checked ? undefined : false })"
                  />
                  <span>Can be counted in group statistics. Nobody is named, and a member can ask to be left out.</span>
                </label>
                <!--
                  An opt IN, and the polarity is the point. Answers are private
                  unless this box is ticked, so an unticked box is the default
                  state of every question and ticking one is a decision to
                  publish that answer on `/u/:username`. `sensitive` overrides
                  it: a sensitive answer is never published whatever this says.
                -->
                <label class="cpub-persona-check">
                  <input
                    type="checkbox"
                    :checked="df.field.showOnProfile === true"
                    :aria-label="`${df.field.label || 'Question'} is published on the public profile`"
                    @change="patchField(df, { showOnProfile: ($event.target as HTMLInputElement).checked ? true : undefined })"
                  />
                  <span>Publish this answer on the member's public profile. Off by default: answers are private.</span>
                </label>
                <span v-if="df.field.column" class="cpub-persona-badge cpub-persona-badge--file">
                  Bound to the profile field {{ df.field.column }}
                </span>
              </div>

              <div class="cpub-persona-field-foot">
                <span v-if="storedRows(df.origKey) !== null" class="cpub-persona-rows">
                  {{ rowsPhrase(storedRows(df.origKey) ?? 0) }}
                </span>
                <button
                  type="button"
                  class="cpub-btn cpub-btn-sm cpub-persona-danger"
                  :disabled="!canManage"
                  @click="removeField(ds, fi)"
                >
                  <i class="fa-solid fa-trash"></i> Remove question
                </button>
              </div>
            </div>
          </div>

          <p v-if="!ds.fields.length" class="cpub-persona-empty">
            No questions in this section yet.
          </p>

          <button type="button" class="cpub-btn cpub-btn-sm" :disabled="!canManage" @click="addField(ds)">
            <i class="fa-solid fa-plus"></i> Add question
          </button>
        </div>
      </section>

      <div v-if="isDirty" class="cpub-persona-footer">
        <span class="cpub-persona-footer-text">
          {{ blockedReason ?? 'Unsaved changes' }}
        </span>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="discard">Discard</button>
        <button type="button" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="!canSave" @click="save()">
          Save
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Every value here is a token. Sharp corners, 2px borders, offset shadows with
   no blur, per the design system. Tokens live in packages/ui/theme/. */

.cpub-persona-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}
.cpub-persona-head-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.cpub-persona-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
.cpub-persona-subtitle { font-size: var(--text-sm); color: var(--text-dim); margin-top: var(--space-1); }
.cpub-persona-off { padding: var(--space-10) 0; text-align: center; color: var(--text-dim); }
.cpub-persona-off-text { margin-top: var(--space-2); font-size: var(--text-sm); }

.cpub-persona-banner {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  flex-wrap: wrap;
}
.cpub-persona-banner--override { border-color: var(--accent); background: var(--accent-bg); }
.cpub-persona-banner--drift { border-color: var(--yellow); background: var(--yellow-bg); }
.cpub-persona-banner--error { border-color: var(--red); background: var(--red-bg); }
.cpub-persona-banner-body { flex: 1; min-width: 0; }
.cpub-persona-banner-title { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--text); }
.cpub-persona-banner-meta { font-size: var(--text-xs); color: var(--text-dim); margin-top: var(--space-1); }
.cpub-persona-revert { flex-shrink: 0; }

.cpub-persona-drift-list { list-style: none; margin: var(--space-3) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-persona-drift-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  flex-wrap: wrap;
}
.cpub-persona-drift-info { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: baseline; min-width: 0; }
.cpub-persona-drift-kind { font-size: var(--text-xs); font-weight: var(--font-weight-semibold); color: var(--text); }
.cpub-persona-drift-detail { font-size: var(--text-xs); color: var(--text-dim); }
.cpub-persona-drift-rows { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-dim); }
.cpub-persona-drift-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

.cpub-persona-issue-list { margin: var(--space-2) 0 0; padding-left: var(--space-5); font-size: var(--text-sm); color: var(--text); }
.cpub-persona-issue-list li { margin-top: var(--space-1); }

.cpub-persona-removal {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  align-items: center;
}
.cpub-persona-removal-legend { display: flex; gap: var(--space-2); align-items: baseline; flex-wrap: wrap; }
.cpub-persona-removal-count { font-size: var(--text-xs); color: var(--text-dim); }
.cpub-persona-radio { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); min-height: 44px; }
.cpub-persona-radio input { width: 20px; height: 20px; }

.cpub-persona-export { border: var(--border-width-default) solid var(--border); padding: var(--space-4); margin-bottom: var(--space-4); background: var(--surface); }
.cpub-persona-export-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.cpub-persona-export-text { width: 100%; font-family: var(--font-mono); font-size: var(--text-xs); margin-top: var(--space-2); }

.cpub-persona-section {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-block-sm);
  margin-bottom: var(--space-4);
}
.cpub-persona-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-default) solid var(--border2);
  flex-wrap: wrap;
}
.cpub-persona-section-body { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); }
.cpub-persona-disclosure {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  min-height: 44px;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
}
.cpub-persona-disclosure:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-persona-section-name { font-weight: var(--font-weight-semibold); }
.cpub-persona-section-count { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-dim); }

.cpub-persona-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
}
.cpub-persona-badge--override { border-color: var(--accent); color: var(--accent-text); background: var(--accent-bg); }
.cpub-persona-badge--dirty { border-color: var(--yellow); color: var(--yellow-text); background: var(--yellow-bg); }
.cpub-persona-badge--file { border-color: var(--border); color: var(--text-dim); }

.cpub-persona-reorder { display: flex; flex-direction: column; flex-shrink: 0; }
.cpub-persona-iconbtn {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: var(--text-sm);
}
.cpub-persona-iconbtn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.cpub-persona-iconbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.cpub-persona-iconbtn:disabled { opacity: 0.4; cursor: default; }
.cpub-persona-danger { color: var(--red-text); }
.cpub-persona-danger:hover:not(:disabled) { color: var(--red-text); border-color: var(--red); }

.cpub-persona-field {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--border2);
  background: var(--bg);
}
.cpub-persona-field--invalid { border-color: var(--red); }
.cpub-persona-field-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-persona-field-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.cpub-persona-rows { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-dim); }

.cpub-persona-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
/* THE SPACING IS THE `gap` AND NOTHING ELSE.
   The UA default `p { margin-block: 1em }` was never reset here, and flex does
   not collapse margins, so every gap on this screen was really
   `gap + 1em + 1em`. On this page that turned 53 separate 8px gaps into 26px,
   with the em following each element's own font-size. Same defect the two
   member-facing persona pages carried; same fix. Scoped, so the persona
   components keep the margins they set deliberately. */
.cpub-persona-admin :is(h1, h2, h3, h4, p, ul) {
  margin: 0;
}

.cpub-persona-control { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.cpub-persona-mono { font-family: var(--font-mono); }
.cpub-persona-key { font-family: var(--font-mono); font-size: var(--text-xs); }
.cpub-persona-key-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-1); }

.cpub-persona-confirm {
  border: var(--border-width-thick) solid var(--red);
  background: var(--red-bg);
  padding: var(--space-3);
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.cpub-persona-confirm-text { font-size: var(--text-sm); color: var(--text); }
.cpub-persona-confirm-actions { display: flex; gap: var(--space-2); }
.cpub-persona-blocker-actions { margin-top: var(--space-3); flex-wrap: wrap; }

.cpub-persona-options { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-persona-option-row { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.cpub-persona-option-row .cpub-form-input { flex: 1; min-width: 140px; }

.cpub-persona-toggles { display: flex; flex-direction: column; gap: var(--space-1); }
.cpub-persona-check { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-dim); min-height: 44px; }
.cpub-persona-check input { width: 20px; height: 20px; flex-shrink: 0; }

.cpub-persona-error { font-size: var(--text-xs); color: var(--red-text); }
.cpub-persona-error--option { flex-basis: 100%; }
.cpub-persona-empty { font-size: var(--text-sm); color: var(--text-dim); }

.cpub-persona-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-4);
  border: var(--border-width-default) solid var(--yellow);
  background: var(--yellow-bg);
}
.cpub-persona-footer-text { flex: 1; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--yellow-text); }

@media (max-width: 768px) {
  .cpub-persona-head { flex-direction: column; }
  .cpub-persona-grid { grid-template-columns: 1fr; }
  .cpub-persona-field { flex-direction: column; }
  .cpub-persona-reorder { flex-direction: row; }
}
</style>
