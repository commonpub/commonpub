<script setup lang="ts">
/**
 * FormTemplateEditor — the SHARED operator form builder, used by both the per-stage
 * entry SUBMISSION form (ContestStageCard) and the contest REGISTRATION form
 * (ContestEditor). Operates on ONE `FormField[]` and emits the whole new array
 * (`update:template`); the pure array ops live in utils/contestStages.ts.
 *
 * Fields: reorder with keyboard-first up/down buttons (with an aria-live
 * announcement); a grouped type picker offering every field type (section / radio /
 * tel + the PII-gated agreement/address); an optional per-field character cap; and
 * one-click presets + whole-form templates.
 *
 * The optional block INTRO (markdown → BlockTuple[]) is stage-only, gated by
 * `enableIntro`. agreement/address types + the per-field PII toggle are gated behind
 * `features.contestPii` (rule #2); PII *access* is always gated server-side.
 */
import type { FormField, FormFieldCondition } from '@commonpub/schema';
import { markdownToBlockTuples, blockTuplesToMarkdown, type BlockTuple } from '@commonpub/editor';
import {
  availableFieldPresets,
  availableFormTemplates,
  templatePresetAdded,
  type FieldPreset,
  type SubmissionFormTemplate,
} from '../../utils/contestSubmissionTemplates';
import { registrationMarkdownToTemplate, templateToRegistrationMarkdown } from '../../utils/registrationMarkdown';

type FieldType = FormField['type'];

const props = withDefaults(defineProps<{
  template: FormField[];
  /** Stage-only block intro (rendered above the fields on the public form). */
  instructions?: BlockTuple[];
  /** Show the block-intro affordance (stage editor only). */
  enableIntro?: boolean;
  /** Show the "Import / export as markdown" affordance (registration editor). */
  enableMarkdown?: boolean;
  /** Heading shown above the builder. */
  label?: string;
  /** One-line hint under the heading. */
  hint?: string;
  /**
   * Optional editor↔preview link: the field index currently "active" (focused in
   * the editor or clicked in a paired preview). The matching card is highlighted
   * and scrolled into view. Opt-in — the stages usage omits it (no behaviour
   * change); the registration builder syncs it with its live preview.
   */
  activeIndex?: number;
  /**
   * Field keys that have already been SAVED, and must therefore never be
   * regenerated from a label edit — they are what stored answers hang off. The
   * parent snapshots these when it hydrates the template; keys added in this
   * session are absent and keep tracking their label.
   */
  lockedKeys?: string[];
}>(), { enableIntro: false, enableMarkdown: false, label: 'Form', hint: '', activeIndex: -1, lockedKeys: () => [] });

const emit = defineEmits<{
  'update:template': [template: FormField[]];
  'update:instructions': [blocks: BlockTuple[]];
  /** A card gained focus or was clicked — drives the paired preview highlight. */
  'field-activate': [index: number];
}>();

// ─── Editor↔preview linking (opt-in via activeIndex + field-activate) ───
const cardEls = ref<Array<HTMLElement | null>>([]);
function setCardRef(fi: number, el: unknown): void {
  cardEls.value[fi] = (el as HTMLElement) ?? null;
}
function activateCard(fi: number): void {
  emit('field-activate', fi);
}
watch(
  () => props.activeIndex,
  (i) => {
    if (i == null || i < 0) return;
    // block: 'nearest' is a no-op when the card is already visible (e.g. the
    // editor card that just took focus), so this only scrolls on preview→editor.
    cardEls.value[i]?.scrollIntoView({ block: 'nearest' });
  },
);

const { features } = useFeatures();
const piiEnabled = computed(() => features.value.contestPii === true);
// Private file/signature uploads (P6) require the private-storage path.
const privateFilesEnabled = computed(() => features.value.contestPrivateFiles === true);
// Conditional display (P7). Like `contestPii`, the flag governs what the BUILDER
// OFFERS; a stored condition is always honoured by the forms and the server, so
// turning this off never resurrects a hidden required field mid-contest.
const conditionsEnabled = computed(() => features.value.contestConditionalFields === true);

// Grouped, described type picker (rule: PII/file types gated).
const FIELD_TYPE_GROUPS = computed<Array<{ group: string; types: FieldType[] }>>(() => {
  const groups: Array<{ group: string; types: FieldType[] }> = [
    { group: 'Basic', types: ['text', 'textarea', 'number', 'date'] },
    { group: 'Choice', types: ['select', 'radio', 'checkbox'] },
    { group: 'Contact', types: ['email', 'tel', 'url'] },
    { group: 'Layout', types: ['section'] },
  ];
  const personal: FieldType[] = [];
  if (piiEnabled.value) personal.push('agreement', 'address', 'signature');
  if (piiEnabled.value && privateFilesEnabled.value) personal.push('file');
  if (personal.length) groups.push({ group: 'Consent & personal data', types: personal });
  return groups;
});

// Type options for one field's <select>. Always includes the field's CURRENT type,
// even if its add-menu group is gated off (e.g. a saved `file`/`signature` field kept
// after contestPrivateFiles/contestPii was disabled) — otherwise the select has no
// matching option, shows a wrong value, and silently coerces the type on first change.
function typeGroupsForField(current: FieldType): Array<{ group: string; types: FieldType[] }> {
  const groups = FIELD_TYPE_GROUPS.value;
  if (groups.some((g) => g.types.includes(current))) return groups;
  return [...groups, { group: 'Current (feature disabled)', types: [current] }];
}

// The `file` preset additionally needs the private-storage flag.
const fieldPresets = computed(() =>
  availableFieldPresets(piiEnabled.value).filter((p) => p.id !== 'file' || privateFilesEnabled.value),
);
const formTemplates = computed(() => availableFormTemplates(piiEnabled.value));

/** Text-ish types that support a character cap. */
function hasMaxLength(type: FieldType): boolean {
  return type === 'text' || type === 'textarea' || type === 'url' || type === 'email' || type === 'tel';
}

// ─── Reorder (keyboard-first) with an aria-live announcement ───
const announcement = ref('');
function move(fi: number, delta: number): void {
  const moved = templateFieldMoved(props.template, fi, delta);
  if (moved === props.template) return; // at an edge
  emit('update:template', moved);
  const to = fi + delta;
  announcement.value = `Moved "${props.template[fi]?.label || 'field'}" to position ${to + 1} of ${props.template.length}.`;
}

// ─── Two small dropdown menus (Add field · Use a template) ───
const menuWrap = ref<HTMLElement | null>(null);
const openMenu = ref<'add' | 'template' | null>(null);
function toggleMenu(which: 'add' | 'template'): void {
  openMenu.value = openMenu.value === which ? null : which;
}
function closeMenu(): void {
  openMenu.value = null;
}
function onDocPointer(e: PointerEvent): void {
  if (openMenu.value && menuWrap.value && !menuWrap.value.contains(e.target as Node)) closeMenu();
}
function onDocKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && openMenu.value) closeMenu();
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onDocKey);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointer);
  document.removeEventListener('keydown', onDocKey);
});

function addPreset(preset: FieldPreset): void {
  emit('update:template', templatePresetAdded(props.template, preset));
  closeMenu();
}
function applyFormTemplate(tpl: SubmissionFormTemplate): void {
  closeMenu();
  if (props.template.length && typeof window !== 'undefined' && !window.confirm(`Replace the current ${props.template.length} field(s) with the "${tpl.label}" template?`)) {
    return;
  }
  emit('update:template', tpl.build({ pii: piiEnabled.value, privateFiles: privateFilesEnabled.value }));
}

// ─── Import / export as markdown (registration editor only) ───
const showMarkdown = ref(false);
const markdownText = ref('');
const markdownErrors = ref<string[]>([]);
function toggleMarkdown(): void {
  closeMenu();
  showMarkdown.value = !showMarkdown.value;
  if (showMarkdown.value) loadCurrentMarkdown();
}
function loadCurrentMarkdown(): void {
  markdownText.value = templateToRegistrationMarkdown(props.template);
  markdownErrors.value = [];
}
/**
 * Re-attach saved keys to imported fields.
 *
 * The DSL carries labels, not keys, so an import recomputes every key from its
 * label — which silently orphans every stored answer under the old key, and did
 * so straight past the key lock. Matching on label restores the key for fields
 * the operator did not rename; anything genuinely new keeps its derived key.
 */
function withPreservedKeys(fields: FormField[]): FormField[] {
  const savedByLabel = new Map<string, string>();
  for (const f of props.template) {
    if (!f.key || !lockedKeySet.value.has(f.key)) continue;
    const label = f.label.trim().toLowerCase();
    // A duplicate label cannot be matched unambiguously, so decline to guess.
    savedByLabel.set(label, savedByLabel.has(label) ? '' : f.key);
  }
  const used = new Set<string>();
  // imported key -> restored saved key, for the condition rewrite below.
  const renamed = new Map<string, string>();
  const rekeyed = fields.map((f) => {
    const saved = savedByLabel.get(f.label.trim().toLowerCase());
    if (!saved || used.has(saved)) return f;
    used.add(saved);
    if (f.key && f.key !== saved) renamed.set(f.key, saved);
    return { ...f, key: saved };
  });
  if (!renamed.size) return rekeyed;
  // Carry every condition to the restored key. The DSL names fields by label, so
  // a hand-written `show=` points at the key the PARSER derived; restoring the
  // saved key underneath it would orphan the rule, and the repair pass would then
  // delete it without a word. Same move `templateFieldLabelChanged` makes.
  return rekeyed.map((f) => {
    const target = f.showWhen && renamed.get(f.showWhen.field);
    return target ? { ...f, showWhen: { ...f.showWhen!, field: target } } : f;
  });
}

function importMarkdown(): void {
  const { fields: parsed, errors } = registrationMarkdownToTemplate(markdownText.value);
  markdownErrors.value = errors;
  if (errors.length) return; // block on problems; the operator fixes + re-imports
  const fields = templateConditionsRepaired(withPreservedKeys(parsed));
  // Name the answers that will be orphaned, rather than reporting only a count of
  // fields: replacing a form whose keys have answers behind them is the risky part.
  const orphaned = props.template.filter(
    (f) => f.key && lockedKeySet.value.has(f.key) && !fields.some((n) => n.key === f.key),
  );
  const warning = orphaned.length
    ? `\n\n${orphaned.length} saved field(s) will no longer match existing answers: ${orphaned.map((f) => f.label || f.key).join(', ')}.`
    : '';
  if (
    props.template.length &&
    typeof window !== 'undefined' &&
    !window.confirm(`Replace the current ${props.template.length} field(s) with ${fields.length} field(s) from markdown?${warning}`)
  ) {
    return;
  }
  emit('update:template', fields);
  showMarkdown.value = false;
}

// ─── Per-field edits (delegate to the pure array ops) ───
const lockedKeySet = computed(() => new Set(props.lockedKeys));
function labelInput(fi: number, e: Event): void {
  emit('update:template', templateFieldLabelChanged(props.template, fi, (e.target as HTMLInputElement).value, lockedKeySet.value));
}
function setField(fi: number, patch: Partial<FormField>): void {
  emit('update:template', templateFieldSet(props.template, fi, patch));
}
function changeType(fi: number, type: FieldType): void {
  emit('update:template', templateFieldTypeChanged(props.template, fi, type));
}
function removeField(fi: number): void {
  emit('update:template', templateFieldRemoved(props.template, fi));
}
function addOption(fi: number): void {
  emit('update:template', templateOptionAdded(props.template, fi));
}
function setOption(fi: number, oi: number, patch: Partial<{ value: string; label: string }>): void {
  emit('update:template', templateOptionSet(props.template, fi, oi, patch));
}
function removeOption(fi: number, oi: number): void {
  emit('update:template', templateOptionRemoved(props.template, fi, oi));
}
// ─── Conditional display: "show this field only when…" ───
/** Eligible sources for field `fi` (closed-answer types ABOVE it). */
function sourcesFor(fi: number): FormField[] {
  return conditionSourcesFor(props.template, fi);
}
/** The values a source can produce, as builder choices. A thin local wrapper so
 *  the TEMPLATE binds a component-scope function rather than depending on an
 *  auto-import resolving through the render context, which it does not. */
function valueChoicesFor(source: FormField): Array<{ value: string; label: string }> {
  return conditionValueChoices(source);
}
/** The field a condition points at, if it is still resolvable. */
function sourceOf(field: FormField): FormField | undefined {
  return field.showWhen ? props.template.find((f) => f.key === field.showWhen!.field) : undefined;
}
function setCondition(fi: number, cond: FormFieldCondition | null): void {
  emit('update:template', templateFieldConditionSet(props.template, fi, cond));
}
/** Turn the rule on (seeding the first eligible source) or off. */
function toggleCondition(fi: number, on: boolean): void {
  if (!on) return setCondition(fi, null);
  const first = sourcesFor(fi)[0];
  if (!first) return;
  setCondition(fi, { field: first.key, equals: [] });
}
/** Re-point a rule at a different source; the old values cannot survive the move. */
function setConditionSource(fi: number, key: string): void {
  setCondition(fi, { field: key, equals: [] });
}
/** Check / uncheck one value of the rule. Emptying it removes the rule, because a
 *  rule matching nothing would hide the field forever with no way back. */
function toggleConditionValue(fi: number, value: string, on: boolean): void {
  const cond = props.template[fi]?.showWhen;
  if (!cond) return;
  const equals = on ? [...new Set([...cond.equals, value])] : cond.equals.filter((v) => v !== value);
  setCondition(fi, equals.length ? { ...cond, equals } : null);
}

function setMaxLength(fi: number, raw: string): void {
  const n = parseInt(raw, 10);
  setField(fi, { maxLength: Number.isFinite(n) && n > 0 ? Math.min(n, 4000) : undefined });
}

// ─── Block intro (markdown ⇄ BlockTuple[]) — stage-only ───
const showIntro = ref((props.instructions?.length ?? 0) > 0);
const introText = ref(blockTuplesToMarkdown(props.instructions ?? []));
const introPreview = computed<BlockTuple[]>(() => markdownToBlockTuples(introText.value));
watch(
  () => props.instructions,
  (b) => {
    const incoming = JSON.stringify(b ?? []);
    if (incoming === JSON.stringify(introPreview.value)) return; // our own echo
    introText.value = blockTuplesToMarkdown(b ?? []);
    if ((b?.length ?? 0) > 0) showIntro.value = true;
  },
);
function onIntroInput(e: Event): void {
  introText.value = (e.target as HTMLTextAreaElement).value;
  emit('update:instructions', introText.value.trim() ? introPreview.value : []);
}
function toggleIntro(): void {
  showIntro.value = !showIntro.value;
  if (!showIntro.value && introText.value.trim()) {
    introText.value = '';
    emit('update:instructions', []);
  }
}
</script>

<template>
  <div class="cpub-fte">
    <div class="cpub-fte-head">
      <span class="cpub-form-label cpub-fte-title">{{ label }}</span>
      <div ref="menuWrap" class="cpub-fte-menus">
        <!-- Import / export as markdown -->
        <button v-if="enableMarkdown" type="button" class="cpub-btn cpub-btn-sm" :aria-expanded="showMarkdown" @click="toggleMarkdown">
          <i class="fa-solid fa-file-lines"></i> Markdown
        </button>
        <!-- Use a template -->
        <div class="cpub-fte-menu">
          <button type="button" class="cpub-btn cpub-btn-sm" aria-haspopup="menu" :aria-expanded="openMenu === 'template'" @click="toggleMenu('template')">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Use a template <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div v-if="openMenu === 'template'" class="cpub-fte-dropdown" role="menu" aria-label="Form templates">
            <button v-for="tpl in formTemplates" :key="tpl.id" type="button" role="menuitem" class="cpub-fte-item" @click="applyFormTemplate(tpl)">
              <span class="cpub-fte-item-label">{{ tpl.label }}</span>
              <span class="cpub-fte-item-desc">{{ tpl.description }}</span>
            </button>
          </div>
        </div>
        <!-- Add a field (presets) -->
        <div class="cpub-fte-menu">
          <button type="button" class="cpub-btn cpub-btn-sm" aria-haspopup="menu" :aria-expanded="openMenu === 'add'" @click="toggleMenu('add')">
            <i class="fa-solid fa-plus"></i> Add field <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div v-if="openMenu === 'add'" class="cpub-fte-dropdown" role="menu" aria-label="Field presets">
            <button v-for="preset in fieldPresets" :key="preset.id" type="button" role="menuitem" class="cpub-fte-item cpub-fte-item-row" @click="addPreset(preset)">
              <i class="fa-solid cpub-fte-item-icon" :class="preset.icon"></i>
              <span class="cpub-fte-item-label">{{ preset.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <p v-if="hint" class="cpub-form-hint cpub-fte-hint">{{ hint }}</p>

    <!-- Import / export as markdown (registration editor). Author the whole form as
         text, or copy the current form out as markdown to hand off / regenerate. -->
    <div v-if="enableMarkdown && showMarkdown" class="cpub-fte-md">
      <div class="cpub-fte-md-head">
        <span class="cpub-form-label cpub-fte-md-label">Form as markdown</span>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="loadCurrentMarkdown">
          <i class="fa-solid fa-rotate"></i> Load current form
        </button>
      </div>
      <textarea
        v-model="markdownText"
        class="cpub-form-input cpub-form-textarea cpub-fte-md-text"
        rows="12"
        spellcheck="false"
        aria-label="Registration form as markdown"
        placeholder="## Section title&#10;- Field label* (type): option one, option two&#10;  > help text"
      ></textarea>
      <ul v-if="markdownErrors.length" class="cpub-fte-md-errors" role="alert">
        <li v-for="(e, ei) in markdownErrors" :key="ei">{{ e }}</li>
      </ul>
      <div class="cpub-fte-md-actions">
        <button type="button" class="cpub-btn cpub-btn-primary cpub-btn-sm" @click="importMarkdown">
          <i class="fa-solid fa-file-import"></i> Import (replace form)
        </button>
        <span class="cpub-form-hint cpub-fte-md-hint">
          <code>## Title</code> = section · <code>- Label* (type): a, b</code> = field ·
          indented <code>-</code> lines under an <code>(agreement)</code> = its terms.
        </span>
      </div>
    </div>

    <!-- Stage-only block intro. -->
    <div v-if="enableIntro" class="cpub-fte-intro">
      <label class="cpub-fte-req">
        <input type="checkbox" :checked="showIntro" aria-label="Add instructions above the form" @change="toggleIntro" />
        <span>Add instructions above the form</span>
      </label>
      <div v-if="showIntro" class="cpub-fte-intro-edit">
        <textarea :value="introText" class="cpub-form-input cpub-form-textarea" rows="3" placeholder="Markdown instructions shown above the form (what to submit, tips, links)." aria-label="Form instructions (markdown)" @input="onIntroInput"></textarea>
        <div v-if="introPreview.length" class="cpub-fte-intro-preview">
          <span class="cpub-form-hint cpub-fte-preview-label">Preview</span>
          <BlocksBlockContentRenderer :blocks="introPreview" class="cpub-prose cpub-md" />
        </div>
      </div>
    </div>

    <!-- aria-live reorder announcements. -->
    <div class="cpub-sr-only" aria-live="polite">{{ announcement }}</div>

    <div
      v-for="(tf, fi) in template"
      :key="fi"
      :ref="(el) => setCardRef(fi, el)"
      class="cpub-fte-card"
      :class="{ 'cpub-fte-card--section': tf.type === 'section', 'cpub-fte-card--active': fi === activeIndex }"
      @focusin="activateCard(fi)"
    >
      <div class="cpub-fte-reorder" role="group" :aria-label="`Reorder ${tf.label || 'field'}`">
        <button type="button" class="cpub-fte-iconbtn" :disabled="fi === 0" :aria-label="`Move ${tf.label || 'field'} up`" @click="move(fi, -1)"><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" class="cpub-fte-iconbtn" :disabled="fi === template.length - 1" :aria-label="`Move ${tf.label || 'field'} down`" @click="move(fi, 1)"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      <div class="cpub-fte-body">
        <div class="cpub-fte-main">
          <input :value="tf.label" type="text" class="cpub-form-input" :placeholder="tf.type === 'section' ? 'Section title' : 'Field label (e.g. Repository URL)'" :aria-label="`Field ${fi + 1} label`" @input="labelInput(fi, $event)" />
          <select :value="tf.type" class="cpub-form-input cpub-fte-type" :aria-label="`Field ${fi + 1} type`" @change="changeType(fi, ($event.target as HTMLSelectElement).value as FieldType)">
            <optgroup v-for="g in typeGroupsForField(tf.type)" :key="g.group" :label="g.group">
              <option v-for="t in g.types" :key="t" :value="t">{{ TEMPLATE_FIELD_TYPE_LABEL[t] }}</option>
            </optgroup>
          </select>
          <label v-if="tf.type !== 'section'" class="cpub-fte-req">
            <input type="checkbox" :checked="tf.required" :aria-label="`Field ${fi + 1} required`" @change="setField(fi, { required: ($event.target as HTMLInputElement).checked })" />
            <span>Required</span>
          </label>
          <button type="button" class="cpub-fte-iconbtn cpub-fte-del" aria-label="Remove field" @click="removeField(fi)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <input :value="tf.help ?? ''" type="text" class="cpub-form-input cpub-fte-help" :placeholder="tf.type === 'section' ? 'Description shown under the section title (optional)' : 'Hint shown under the input (optional)'" :aria-label="`Field ${fi + 1} ${tf.type === 'section' ? 'description' : 'hint'}`" @input="setField(fi, { help: ($event.target as HTMLInputElement).value || undefined })" />

        <!-- Optional character cap (text-ish types). -->
        <label v-if="hasMaxLength(tf.type)" class="cpub-fte-maxlen">
          <span>Max length</span>
          <input type="number" min="1" max="4000" class="cpub-form-input" :value="tf.maxLength ?? ''" placeholder="4000" :aria-label="`Field ${fi + 1} max length`" @input="setMaxLength(fi, ($event.target as HTMLInputElement).value)" />
        </label>

        <!-- select/radio: the allowed options -->
        <div v-if="tf.type === 'select' || tf.type === 'radio'" class="cpub-fte-extra">
          <span class="cpub-form-hint cpub-fte-extra-label">Choices</span>
          <div v-for="(opt, oi) in (tf.options ?? [])" :key="oi" class="cpub-fte-opt-row">
            <input :value="opt.label" type="text" class="cpub-form-input" placeholder="Label (shown to entrants)" :aria-label="`Field ${fi + 1} option ${oi + 1} label`" @input="setOption(fi, oi, { label: ($event.target as HTMLInputElement).value })" />
            <input :value="opt.value" type="text" class="cpub-form-input" placeholder="Value (stored)" :aria-label="`Field ${fi + 1} option ${oi + 1} value`" @input="setOption(fi, oi, { value: ($event.target as HTMLInputElement).value })" />
            <button type="button" class="cpub-fte-iconbtn cpub-fte-del" aria-label="Remove option" @click="removeOption(fi, oi)"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addOption(fi)"><i class="fa-solid fa-plus"></i> Add choice</button>
        </div>

        <!-- agreement: terms the entrant must accept -->
        <div v-if="tf.type === 'agreement'" class="cpub-fte-extra">
          <textarea :value="tf.terms ?? ''" class="cpub-form-input cpub-form-textarea" rows="3" placeholder="Terms the entrant must accept" :aria-label="`Field ${fi + 1} agreement terms`" @input="setField(fi, { terms: ($event.target as HTMLTextAreaElement).value || undefined })"></textarea>
          <label class="cpub-fte-req">
            <input type="checkbox" :checked="tf.mustAccept !== false" :aria-label="`Field ${fi + 1} must accept`" @change="setField(fi, { mustAccept: ($event.target as HTMLInputElement).checked })" />
            <span>Must accept to submit</span>
          </label>
        </div>

        <!-- address: structured + always personal data -->
        <p v-if="tf.type === 'address'" class="cpub-form-hint cpub-fte-note">
          Collected as a structured mailing address and stored as personal data. Visible only to staff with PII access and the entrant.
        </p>
        <p v-else-if="tf.type === 'file'" class="cpub-form-hint cpub-fte-note">
          The uploaded file is stored privately. Visible only to staff with PII access and the entrant.
        </p>
        <p v-else-if="tf.type === 'signature'" class="cpub-form-hint cpub-fte-note">
          A signed name is personal data, stored privately. Visible only to staff with PII access and the entrant.
        </p>

        <!-- Conditional display (P7): show this field only when an EARLIER
             closed-answer field matches. Offered only when there IS such a field
             above, so the control never appears where it cannot be used. -->
        <div v-if="conditionsEnabled && sourcesFor(fi).length" class="cpub-fte-cond">
          <label class="cpub-fte-req">
            <input
              type="checkbox"
              :checked="!!tf.showWhen"
              :aria-label="`Field ${fi + 1}: only show when another answer matches`"
              @change="toggleCondition(fi, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ tf.type === 'section' ? 'Only show this section when…' : 'Only show this field when…' }}</span>
          </label>

          <div v-if="tf.showWhen" class="cpub-fte-cond-body">
            <label class="cpub-fte-cond-row">
              <span class="cpub-form-hint">Depends on</span>
              <select
                :value="tf.showWhen.field"
                class="cpub-form-input"
                :aria-label="`Field ${fi + 1} condition source`"
                @change="setConditionSource(fi, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="src in sourcesFor(fi)" :key="src.key" :value="src.key">
                  {{ src.label || src.key }}
                </option>
              </select>
            </label>

            <fieldset v-if="sourceOf(tf)" class="cpub-fte-cond-values">
              <legend class="cpub-form-hint">Shown when the answer is</legend>
              <label v-for="choice in valueChoicesFor(sourceOf(tf)!)" :key="choice.value" class="cpub-fte-req">
                <input
                  type="checkbox"
                  :checked="tf.showWhen.equals.includes(choice.value)"
                  @change="toggleConditionValue(fi, choice.value, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ choice.label }}</span>
              </label>
            </fieldset>

            <p class="cpub-form-hint cpub-fte-note">
              While hidden, this {{ tf.type === 'section' ? 'section and the fields under it are' : 'field is' }}
              not shown, not required, and nothing is stored for it.
              <template v-if="tf.type === 'section'"> The rule covers every field down to the next section.</template>
            </p>
          </div>
        </div>

        <!-- PII toggle. Hidden for types that are ALWAYS/DEFAULT personal data
             (address, file, signature — see @commonpub/schema isFormFieldPii), where
             the opt-in would be a no-op; and for non-answer types (agreement/section). -->
        <label
          v-if="piiEnabled && !['address', 'file', 'signature', 'agreement', 'section'].includes(tf.type)"
          class="cpub-fte-req cpub-fte-pii"
        >
          <input type="checkbox" :checked="tf.pii === true" :aria-label="`Field ${fi + 1} is personal data`" @change="setField(fi, { pii: ($event.target as HTMLInputElement).checked || undefined })" />
          <span>Personal data (store privately, hide from the public listing)</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Field controls (.cpub-form-input/.cpub-form-textarea) come from the global
   forms.css — the same strong-border control the contest editor family shares.
   This block styles only the builder-specific chrome (head, menus, cards). */

/* Builder container — borderless; the field cards carry the structure. */
.cpub-fte { margin-top: var(--space-1); }
.cpub-fte-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.cpub-fte-title { margin: 0; }
.cpub-fte-hint { margin: var(--space-1) 0 0; }
.cpub-fte-menus { display: flex; gap: var(--space-2); flex-wrap: wrap; }

/* Import / export as markdown panel. */
.cpub-fte-md { margin-top: var(--space-3); padding: var(--space-3); border: var(--border-width-default) solid var(--border2); background: var(--surface2); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-fte-md-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.cpub-fte-md-label { margin: 0; }
.cpub-fte-md-text { font-family: var(--font-mono); font-size: var(--text-xs); line-height: var(--leading-snug); background: var(--surface); }
.cpub-fte-md-errors { margin: 0; padding-left: var(--space-4); color: var(--red-text); font-size: var(--text-xs); display: flex; flex-direction: column; gap: var(--space-1); }
.cpub-fte-md-actions { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.cpub-fte-md-hint { margin: 0; }
.cpub-fte-menu { position: relative; }
.cpub-fte-dropdown { position: absolute; right: 0; top: calc(100% + var(--space-1)); z-index: var(--z-dropdown); min-width: 220px; max-height: 320px; overflow-y: auto; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); display: flex; flex-direction: column; }
.cpub-fte-item { display: flex; flex-direction: column; gap: var(--space-1); align-items: flex-start; text-align: left; padding: var(--space-2) var(--space-3); background: transparent; border: none; border-bottom: var(--border-width-thin) solid var(--border2); cursor: pointer; color: var(--text); }
.cpub-fte-item:last-child { border-bottom: none; }
.cpub-fte-item:hover { background: var(--accent-bg); }
.cpub-fte-item-row { flex-direction: row; align-items: center; gap: var(--space-2); }
.cpub-fte-item-icon { color: var(--accent); width: 16px; text-align: center; }
.cpub-fte-item-label { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
.cpub-fte-item-desc { font-size: var(--text-xs); color: var(--text-faint); line-height: var(--leading-snug); }

/* "Add instructions" block (stage editor only) — solid panel. */
.cpub-fte-intro { margin: var(--space-3) 0; padding: var(--space-3); border: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-fte-intro-edit { margin-top: var(--space-2); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-fte-intro-preview { border-top: var(--border-width-thin) solid var(--border2); padding-top: var(--space-2); }
.cpub-fte-preview-label { display: block; margin: 0 0 var(--space-1); }

/* Field CARD: a reorder rail + the field body. */
.cpub-fte-card { display: flex; gap: var(--space-2); margin-top: var(--space-2); padding: var(--space-3); border: var(--border-width-default) solid var(--border2); background: var(--surface2); scroll-margin: var(--space-3); transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.cpub-fte-card--section { border-left: var(--border-width-thick) solid var(--accent); }
/* Active card (editor↔preview link): accent frame, no layout shift. */
.cpub-fte-card--active { border-color: var(--accent); box-shadow: var(--shadow-accent); }
.cpub-fte-reorder { display: flex; flex-direction: column; gap: var(--space-1); flex-shrink: 0; }
.cpub-fte-body { flex: 1; min-width: 0; }

.cpub-fte-iconbtn { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; width: 26px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: var(--text-xs); }
.cpub-fte-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-fte-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
.cpub-fte-del:hover { border-color: var(--red-border); color: var(--red-text); }

.cpub-fte-main { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.cpub-fte-main .cpub-form-input { flex: 2; min-width: 140px; }
.cpub-fte-type { flex: 1 !important; min-width: 120px !important; max-width: 170px; }
.cpub-fte-req { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-label); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-faint); cursor: pointer; flex-shrink: 0; }
.cpub-fte-req input { width: 13px; height: 13px; flex-shrink: 0; }
.cpub-fte-help { margin-top: var(--space-2); font-size: var(--text-xs); }
.cpub-fte-cond { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); padding-top: var(--space-2); border-top: var(--border-width-default) solid var(--border2); }
.cpub-fte-cond-body { display: flex; flex-direction: column; gap: var(--space-2); padding-left: var(--space-4); }
.cpub-fte-cond-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.cpub-fte-cond-row select { flex: 1 1 200px; min-width: 0; }
.cpub-fte-cond-values { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); border: none; padding: 0; margin: 0; min-width: 0; }
.cpub-fte-cond-values legend { padding: 0; margin-bottom: var(--space-1); }
.cpub-fte-note { margin: var(--space-1) 0 0; }
.cpub-fte-maxlen { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); font-size: var(--text-label); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-faint); }
.cpub-fte-maxlen .cpub-form-input { width: 90px; }
.cpub-fte-extra { margin-top: var(--space-2); padding: var(--space-3); border: var(--border-width-default) solid var(--border2); background: var(--surface); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-fte-extra-label { margin: 0; }
.cpub-fte-opt-row { display: flex; align-items: center; gap: var(--space-2); }
.cpub-fte-opt-row .cpub-form-input { flex: 1; min-width: 100px; }
.cpub-fte-pii { margin-top: var(--space-2); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
