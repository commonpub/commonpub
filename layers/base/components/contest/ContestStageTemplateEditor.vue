<script setup lang="ts">
/**
 * ContestStageTemplateEditor — the per-stage SUBMISSION FORM builder, extracted
 * from ContestStagesEditor so the (heaviest, flag-gated) part of the stage card is
 * its own cohesive unit. Operates on ONE stage's `submissionTemplate` array and
 * emits the whole new array (`update:template`); the pure array ops live in
 * utils/contestStages.ts. P2 added (a) one-click field PRESETS, (b) whole-form
 * TEMPLATES, and (c) a block INTRO rendered above the fields on the public form.
 *
 * The intro is authored as markdown but STORED as `instructionsBlocks` (BlockTuple[]
 * — the same shape the contest bodies use), so it renders through BlockContentRenderer
 * identically in this preview and on the public submission form. Full drag-drop block
 * editing of the intro is deferred (markdown + live preview is enough, same call the
 * plan made for agreement terms); the storage already supports upgrading later.
 *
 * The agreement/address field types + the per-field PII toggle are gated behind
 * `features.contestPii` (rule #2); PII *access* is always gated server-side by the
 * `contest.pii` permission regardless.
 */
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { markdownToBlockTuples, blockTuplesToMarkdown, type BlockTuple } from '@commonpub/editor';
import {
  availableFieldPresets,
  availableFormTemplates,
  templatePresetAdded,
  type FieldPreset,
  type SubmissionFormTemplate,
} from '../../utils/contestSubmissionTemplates';

const props = defineProps<{
  template: ContestSubmissionTemplateField[];
  /** This stage's block intro (rendered above the fields on the public form). */
  instructions?: BlockTuple[];
}>();
const emit = defineEmits<{
  'update:template': [template: ContestSubmissionTemplateField[]];
  'update:instructions': [blocks: BlockTuple[]];
}>();

const { features } = useFeatures();
const piiEnabled = computed(() => features.value.contestPii === true);
const FIELD_TYPES = computed<ContestSubmissionTemplateField['type'][]>(() => {
  const base: ContestSubmissionTemplateField['type'][] = ['text', 'textarea', 'url', 'email', 'number', 'select', 'checkbox', 'date'];
  if (piiEnabled.value) base.push('agreement', 'address');
  return base;
});

const fieldPresets = computed(() => availableFieldPresets(piiEnabled.value));
const formTemplates = computed(() => availableFormTemplates(piiEnabled.value));

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
  // Replacing a non-empty form is destructive — confirm before clobbering.
  if (props.template.length && typeof window !== 'undefined' && !window.confirm(`Replace the current ${props.template.length} field(s) with the "${tpl.label}" template?`)) {
    return;
  }
  emit('update:template', tpl.build({ pii: piiEnabled.value }));
}

// ─── Per-field edits (delegate to the pure array ops) ───
function labelInput(fi: number, e: Event): void {
  emit('update:template', templateFieldLabelChanged(props.template, fi, (e.target as HTMLInputElement).value));
}
function setField(fi: number, patch: Partial<ContestSubmissionTemplateField>): void {
  emit('update:template', templateFieldSet(props.template, fi, patch));
}
function changeType(fi: number, type: ContestSubmissionTemplateField['type']): void {
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

// ─── Block intro (markdown ⇄ BlockTuple[]) ───
const showIntro = ref((props.instructions?.length ?? 0) > 0);
const introText = ref(blockTuplesToMarkdown(props.instructions ?? []));
const introPreview = computed<BlockTuple[]>(() => markdownToBlockTuples(introText.value));
// Re-sync only on a GENUINELY external change (a form-template reset, a reorder
// reusing this instance). Our own keystroke emits the same blocks straight back;
// re-deriving markdown from them isn't char-exact (round-trip normalisation), so a
// naive `md !== introText` resync would fight the caret. Compare BLOCKS instead:
// if the incoming blocks already match what our current text produces, it's our
// echo — skip.
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
  <div class="cpub-stage-criteria">
    <div class="cpub-stage-criteria-head">
      <span class="cpub-form-label" style="margin: 0;">Submission form, this stage</span>
      <div ref="menuWrap" class="cpub-stf-menus">
        <!-- Use a template -->
        <div class="cpub-stf-menu">
          <button
            type="button"
            class="cpub-btn cpub-btn-sm"
            aria-haspopup="menu"
            :aria-expanded="openMenu === 'template'"
            @click="toggleMenu('template')"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Use a template <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div v-if="openMenu === 'template'" class="cpub-stf-dropdown" role="menu" aria-label="Submission form templates">
            <button
              v-for="tpl in formTemplates"
              :key="tpl.id"
              type="button"
              role="menuitem"
              class="cpub-stf-item"
              @click="applyFormTemplate(tpl)"
            >
              <span class="cpub-stf-item-label">{{ tpl.label }}</span>
              <span class="cpub-stf-item-desc">{{ tpl.description }}</span>
            </button>
          </div>
        </div>
        <!-- Add a field (presets) -->
        <div class="cpub-stf-menu">
          <button
            type="button"
            class="cpub-btn cpub-btn-sm"
            aria-haspopup="menu"
            :aria-expanded="openMenu === 'add'"
            @click="toggleMenu('add')"
          >
            <i class="fa-solid fa-plus"></i> Add field <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div v-if="openMenu === 'add'" class="cpub-stf-dropdown" role="menu" aria-label="Field presets">
            <button
              v-for="preset in fieldPresets"
              :key="preset.id"
              type="button"
              role="menuitem"
              class="cpub-stf-item cpub-stf-item-row"
              @click="addPreset(preset)"
            >
              <i class="fa-solid cpub-stf-item-icon" :class="preset.icon"></i>
              <span class="cpub-stf-item-label">{{ preset.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <p class="cpub-form-hint" style="margin: 4px 0;">Optional. Add fields entrants must fill for this stage (e.g. a proposal summary, or a repository link for a prototype round). Leave empty if entering a project is enough.</p>

    <!-- Block intro: rich instructions shown above the fields on the public form. -->
    <div class="cpub-stf-intro">
      <label class="cpub-stage-tfield-req">
        <input type="checkbox" :checked="showIntro" aria-label="Add instructions above the form" @change="toggleIntro" />
        <span>Add instructions above the form</span>
      </label>
      <div v-if="showIntro" class="cpub-stf-intro-edit">
        <textarea
          :value="introText"
          class="cpub-form-input cpub-form-textarea"
          rows="3"
          placeholder="Markdown instructions shown above the form (what to submit, tips, links)."
          aria-label="Form instructions (markdown)"
          @input="onIntroInput"
        ></textarea>
        <div v-if="introPreview.length" class="cpub-stf-intro-preview">
          <span class="cpub-form-hint" style="margin: 0 0 4px;">Preview</span>
          <BlocksBlockContentRenderer :blocks="introPreview" class="cpub-prose cpub-md" />
        </div>
      </div>
    </div>

    <div v-for="(tf, fi) in template" :key="fi" class="cpub-stage-tfield">
      <div class="cpub-stage-tfield-main">
        <input
          :value="tf.label"
          type="text"
          class="cpub-form-input"
          placeholder="Field label (e.g. Repository URL)"
          :aria-label="`Field ${fi + 1} label`"
          @input="labelInput(fi, $event)"
        />
        <select
          :value="tf.type"
          class="cpub-form-input cpub-stage-tfield-type"
          :aria-label="`Field ${fi + 1} type`"
          @change="changeType(fi, ($event.target as HTMLSelectElement).value as ContestSubmissionTemplateField['type'])"
        >
          <option v-for="t in FIELD_TYPES" :key="t" :value="t">{{ TEMPLATE_FIELD_TYPE_LABEL[t] }}</option>
        </select>
        <label class="cpub-stage-tfield-req">
          <input
            type="checkbox"
            :checked="tf.required"
            :aria-label="`Field ${fi + 1} required`"
            @change="setField(fi, { required: ($event.target as HTMLInputElement).checked })"
          />
          <span>Required</span>
        </label>
        <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove field" @click="removeField(fi)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <input
        :value="tf.help ?? ''"
        type="text"
        class="cpub-form-input cpub-stage-tfield-help"
        placeholder="Hint shown under the input (optional)"
        :aria-label="`Field ${fi + 1} hint`"
        @input="setField(fi, { help: ($event.target as HTMLInputElement).value || undefined })"
      />

      <!-- select: the allowed options -->
      <div v-if="tf.type === 'select'" class="cpub-stage-tfield-extra">
        <span class="cpub-form-hint" style="margin: 0;">Choices</span>
        <div v-for="(opt, oi) in (tf.options ?? [])" :key="oi" class="cpub-stage-opt-row">
          <input
            :value="opt.label"
            type="text"
            class="cpub-form-input"
            placeholder="Label (shown to entrants)"
            :aria-label="`Field ${fi + 1} option ${oi + 1} label`"
            @input="setOption(fi, oi, { label: ($event.target as HTMLInputElement).value })"
          />
          <input
            :value="opt.value"
            type="text"
            class="cpub-form-input"
            placeholder="Value (stored)"
            :aria-label="`Field ${fi + 1} option ${oi + 1} value`"
            @input="setOption(fi, oi, { value: ($event.target as HTMLInputElement).value })"
          />
          <button type="button" class="cpub-stage-iconbtn cpub-stage-del" aria-label="Remove option" @click="removeOption(fi, oi)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addOption(fi)"><i class="fa-solid fa-plus"></i> Add choice</button>
      </div>

      <!-- agreement: terms the entrant must accept -->
      <div v-if="tf.type === 'agreement'" class="cpub-stage-tfield-extra">
        <textarea
          :value="tf.terms ?? ''"
          class="cpub-form-input cpub-form-textarea"
          rows="3"
          placeholder="Terms the entrant must accept (e.g. shipping the hardware to winners)"
          :aria-label="`Field ${fi + 1} agreement terms`"
          @input="setField(fi, { terms: ($event.target as HTMLTextAreaElement).value || undefined })"
        ></textarea>
        <label class="cpub-stage-tfield-req">
          <input
            type="checkbox"
            :checked="tf.mustAccept !== false"
            :aria-label="`Field ${fi + 1} must accept`"
            @change="setField(fi, { mustAccept: ($event.target as HTMLInputElement).checked })"
          />
          <span>Must accept to submit</span>
        </label>
      </div>

      <!-- address: structured + always personal data -->
      <p v-if="tf.type === 'address'" class="cpub-form-hint" style="margin: 4px 0;">
        Collected as a structured mailing address and stored as personal data. Visible only to staff with PII access and the entrant.
      </p>

      <!-- PII toggle (non-address, non-agreement scalar fields) -->
      <label
        v-if="piiEnabled && tf.type !== 'address' && tf.type !== 'agreement'"
        class="cpub-stage-tfield-req cpub-stage-tfield-pii"
      >
        <input
          type="checkbox"
          :checked="tf.pii === true"
          :aria-label="`Field ${fi + 1} is personal data`"
          @change="setField(fi, { pii: ($event.target as HTMLInputElement).checked || undefined })"
        />
        <span>Personal data (store privately, hide from the public listing)</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
/* Scoped CSS doesn't cross component boundaries — the form-control + template-field
   styles travel with this extracted markup (the global theme only provides
   .cpub-form-label/.cpub-form-hint/.cpub-btn). */
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }

.cpub-stage-iconbtn { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.cpub-stage-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-stage-del:hover { border-color: var(--red-border); color: var(--red); }

.cpub-stage-criteria { border: var(--border-width-default) dashed var(--border2); padding: 10px; margin-top: 4px; background: var(--surface); }
.cpub-stage-criteria-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

/* Add-field / template dropdown menus */
.cpub-stf-menus { display: flex; gap: 6px; }
.cpub-stf-menu { position: relative; }
.cpub-stf-dropdown { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 220px; max-height: 320px; overflow-y: auto; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); display: flex; flex-direction: column; }
.cpub-stf-item { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left; padding: 8px 10px; background: transparent; border: none; border-bottom: var(--border-width-default) solid var(--border2); cursor: pointer; color: var(--text); }
.cpub-stf-item:last-child { border-bottom: none; }
.cpub-stf-item:hover { background: var(--accent-bg); }
.cpub-stf-item-row { flex-direction: row; align-items: center; gap: 8px; }
.cpub-stf-item-icon { color: var(--accent); width: 16px; text-align: center; }
.cpub-stf-item-label { font-size: var(--text-sm); font-weight: 600; }
.cpub-stf-item-desc { font-size: var(--text-xs); color: var(--text-faint); line-height: 1.4; }

/* Block intro */
.cpub-stf-intro { margin: 8px 0; padding: 8px; border: var(--border-width-default) dashed var(--border2); background: var(--surface2); }
.cpub-stf-intro-edit { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.cpub-stf-intro-preview { border-top: var(--border-width-default) dashed var(--border2); padding-top: 8px; }

.cpub-stage-tfield { margin-top: 8px; padding-top: 8px; border-top: var(--border-width-default) dashed var(--border2); }
.cpub-stage-tfield:first-of-type { border-top: 0; padding-top: 0; }
.cpub-stage-tfield-main { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cpub-stage-tfield-main .cpub-form-input { flex: 2; min-width: 140px; margin: 0; }
.cpub-stage-tfield-type { flex: 1 !important; min-width: 110px !important; max-width: 150px; }
.cpub-stage-tfield-req { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); cursor: pointer; flex-shrink: 0; }
.cpub-stage-tfield-req input { width: 13px; height: 13px; }
.cpub-stage-tfield-help { margin-top: 6px !important; font-size: var(--text-xs) !important; }
.cpub-stage-tfield-extra { margin-top: 6px; padding: 8px; border: var(--border-width-default) dashed var(--border2); background: var(--surface2); display: flex; flex-direction: column; gap: 6px; }
.cpub-stage-opt-row { display: flex; align-items: center; gap: 6px; }
.cpub-stage-opt-row .cpub-form-input { flex: 1; min-width: 100px; margin: 0; }
.cpub-stage-tfield-pii { margin-top: 6px; }
</style>
