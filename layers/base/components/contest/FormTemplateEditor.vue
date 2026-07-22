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
import type { FormField } from '@commonpub/schema';
import { markdownToBlockTuples, blockTuplesToMarkdown, type BlockTuple } from '@commonpub/editor';
import {
  availableFieldPresets,
  availableFormTemplates,
  templatePresetAdded,
  type FieldPreset,
  type SubmissionFormTemplate,
} from '../../utils/contestSubmissionTemplates';

type FieldType = FormField['type'];

const props = withDefaults(defineProps<{
  template: FormField[];
  /** Stage-only block intro (rendered above the fields on the public form). */
  instructions?: BlockTuple[];
  /** Show the block-intro affordance (stage editor only). */
  enableIntro?: boolean;
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
}>(), { enableIntro: false, label: 'Form', hint: '', activeIndex: -1 });

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

// ─── Per-field edits (delegate to the pure array ops) ───
function labelInput(fi: number, e: Event): void {
  emit('update:template', templateFieldLabelChanged(props.template, fi, (e.target as HTMLInputElement).value));
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
      <span class="cpub-form-label" style="margin: 0;">{{ label }}</span>
      <div ref="menuWrap" class="cpub-fte-menus">
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
    <p v-if="hint" class="cpub-form-hint" style="margin: 4px 0;">{{ hint }}</p>

    <!-- Stage-only block intro. -->
    <div v-if="enableIntro" class="cpub-fte-intro">
      <label class="cpub-fte-req">
        <input type="checkbox" :checked="showIntro" aria-label="Add instructions above the form" @change="toggleIntro" />
        <span>Add instructions above the form</span>
      </label>
      <div v-if="showIntro" class="cpub-fte-intro-edit">
        <textarea :value="introText" class="cpub-form-input cpub-form-textarea" rows="3" placeholder="Markdown instructions shown above the form (what to submit, tips, links)." aria-label="Form instructions (markdown)" @input="onIntroInput"></textarea>
        <div v-if="introPreview.length" class="cpub-fte-intro-preview">
          <span class="cpub-form-hint" style="margin: 0 0 4px;">Preview</span>
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
          <span class="cpub-form-hint" style="margin: 0;">Choices</span>
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
        <p v-if="tf.type === 'address'" class="cpub-form-hint" style="margin: 4px 0;">
          Collected as a structured mailing address and stored as personal data. Visible only to staff with PII access and the entrant.
        </p>
        <p v-else-if="tf.type === 'file'" class="cpub-form-hint" style="margin: 4px 0;">
          The uploaded file is stored privately. Visible only to staff with PII access and the entrant.
        </p>
        <p v-else-if="tf.type === 'signature'" class="cpub-form-hint" style="margin: 4px 0;">
          A signed name is personal data — stored privately. Visible only to staff with PII access and the entrant.
        </p>

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
/* Form-control + card styles travel with this markup (scoped CSS doesn't cross
   component boundaries; the global theme only provides the form-label/hint + btn). */
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }

.cpub-fte { border: var(--border-width-default) dashed var(--border2); padding: 10px; margin-top: 4px; background: var(--surface); }
.cpub-fte-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.cpub-fte-menus { display: flex; gap: 6px; }
.cpub-fte-menu { position: relative; }
.cpub-fte-dropdown { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 220px; max-height: 320px; overflow-y: auto; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); display: flex; flex-direction: column; }
.cpub-fte-item { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left; padding: 8px 10px; background: transparent; border: none; border-bottom: var(--border-width-default) solid var(--border2); cursor: pointer; color: var(--text); }
.cpub-fte-item:last-child { border-bottom: none; }
.cpub-fte-item:hover { background: var(--accent-bg); }
.cpub-fte-item-row { flex-direction: row; align-items: center; gap: 8px; }
.cpub-fte-item-icon { color: var(--accent); width: 16px; text-align: center; }
.cpub-fte-item-label { font-size: var(--text-sm); font-weight: 600; }
.cpub-fte-item-desc { font-size: var(--text-xs); color: var(--text-faint); line-height: 1.4; }

.cpub-fte-intro { margin: 8px 0; padding: 8px; border: var(--border-width-default) dashed var(--border2); background: var(--surface2); }
.cpub-fte-intro-edit { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.cpub-fte-intro-preview { border-top: var(--border-width-default) dashed var(--border2); padding-top: 8px; }

/* Field CARD: a reorder rail + the field body. */
.cpub-fte-card { display: flex; gap: 8px; margin-top: 8px; padding: 8px; border: var(--border-width-default) solid var(--border2); background: var(--surface2); scroll-margin: 12px; transition: border-color 0.12s, box-shadow 0.12s; }
.cpub-fte-card--section { border-left: 3px solid var(--accent); }
/* Active card (editor↔preview link): accent frame, no layout shift. */
.cpub-fte-card--active { border-color: var(--accent); box-shadow: var(--shadow-accent); }
.cpub-fte-reorder { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.cpub-fte-body { flex: 1; min-width: 0; }

.cpub-fte-iconbtn { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; width: 26px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.cpub-fte-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-fte-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
.cpub-fte-del:hover { border-color: var(--red-border); color: var(--red-text); }

.cpub-fte-main { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cpub-fte-main .cpub-form-input { flex: 2; min-width: 140px; margin: 0; }
.cpub-fte-type { flex: 1 !important; min-width: 120px !important; max-width: 170px; }
.cpub-fte-req { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); cursor: pointer; flex-shrink: 0; }
.cpub-fte-req input { width: 13px; height: 13px; }
.cpub-fte-help { margin-top: 6px !important; font-size: var(--text-xs) !important; }
.cpub-fte-maxlen { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); }
.cpub-fte-maxlen .cpub-form-input { width: 90px; margin: 0; }
.cpub-fte-extra { margin-top: 6px; padding: 8px; border: var(--border-width-default) dashed var(--border2); background: var(--surface); display: flex; flex-direction: column; gap: 6px; }
.cpub-fte-opt-row { display: flex; align-items: center; gap: 6px; }
.cpub-fte-opt-row .cpub-form-input { flex: 1; min-width: 100px; margin: 0; }
.cpub-fte-pii { margin-top: 6px; }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
