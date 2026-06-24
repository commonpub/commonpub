<script setup lang="ts">
import type { ContestStage, ContestStageSubmission } from '@commonpub/schema';
import { blockingFields, buildSubmissionPayload } from '../../utils/contestSubmission';

// Per-stage artifact form: an entrant with an entry fills the CURRENT
// submission stage's template fields (a proposal, a prototype's links, ...).
// Driven entirely by `stage.submissionTemplate`; saving PUTs the artifact and
// the server re-validates ownership, stage state, the cohort gate, and fields.

interface EntryLite {
  id: string;
  contentTitle: string;
  eliminated: boolean;
  stageSubmissions?: ContestStageSubmission[];
}

const props = defineProps<{
  contestSlug: string;
  /** The contest's current `submission` stage (must carry a template). */
  stage: ContestStage;
  /** The viewer's OWN entries (parent filters by userId). */
  entries: EntryLite[];
}>();

const emit = defineEmits<{ (e: 'saved'): void }>();

const toast = useToast();
const { extract: extractError } = useApiError();

const template = computed(() => props.stage.submissionTemplate ?? []);
const instructions = computed(() => (props.stage.instructionsBlocks ?? []) as [string, Record<string, unknown>][]);
// Eliminated entries are out of later rounds; don't offer the form for them.
const eligibleEntries = computed(() => props.entries.filter((e) => !e.eliminated));
const selectedEntryId = ref<string>('');
watch(eligibleEntries, (list) => {
  if (!list.some((e) => e.id === selectedEntryId.value)) selectedEntryId.value = list[0]?.id ?? '';
}, { immediate: true });
const selectedEntry = computed(() => eligibleEntries.value.find((e) => e.id === selectedEntryId.value) ?? null);

const existing = computed<ContestStageSubmission | null>(
  () => selectedEntry.value?.stageSubmissions?.find((s) => s.stageId === props.stage.id) ?? null,
);

// Field values, seeded from the already-submitted artifact (if any) so the
// entrant edits in place rather than retyping.
const values = ref<Record<string, string>>({});
watch([existing, template], () => {
  const next: Record<string, string> = {};
  for (const f of template.value) next[f.key] = existing.value?.fields[f.key] ?? '';
  values.value = next;
}, { immediate: true });

const dirty = computed(() =>
  template.value.some((f) => (values.value[f.key] ?? '') !== (existing.value?.fields[f.key] ?? '')),
);
const missingRequired = computed(() => blockingFields(template.value, values.value));

const saving = ref(false);
async function save(): Promise<void> {
  if (!selectedEntryId.value || saving.value) return;
  if (missingRequired.value.length) {
    toast.error(`Please fill: ${missingRequired.value.join(', ')}`);
    return;
  }
  saving.value = true;
  try {
    const fields = buildSubmissionPayload(template.value, values.value);
    await $fetch(`/api/contests/${props.contestSlug}/entries/${selectedEntryId.value}/submission`, {
      method: 'PUT',
      body: { stageId: props.stage.id, fields },
    });
    toast.success(existing.value ? `${props.stage.name} submission updated` : `${props.stage.name} submission received`);
    emit('saved');
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}

function submittedAtLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
</script>

<template>
  <section v-if="eligibleEntries.length && template.length" class="cpub-stagesub" :aria-label="`${stage.name} submission form`">
    <div class="cpub-stagesub-head">
      <h3 class="cpub-stagesub-title"><i class="fa-solid fa-file-pen"></i> {{ stage.name }}: your submission</h3>
      <span v-if="existing" class="cpub-stagesub-badge cpub-stagesub-done">
        <i class="fa-solid fa-circle-check"></i> Submitted {{ submittedAtLabel(existing.submittedAt) }}
      </span>
      <span v-else class="cpub-stagesub-badge cpub-stagesub-todo">
        <i class="fa-solid fa-circle-exclamation"></i> Not submitted yet
      </span>
    </div>
    <p v-if="stage.description" class="cpub-stagesub-desc">{{ stage.description }}</p>
    <BlocksBlockContentRenderer v-if="instructions.length" :blocks="instructions" class="cpub-prose cpub-md cpub-stagesub-intro" />

    <div v-if="eligibleEntries.length > 1" class="cpub-stagesub-field">
      <label class="cpub-stagesub-label" for="cpub-stagesub-entry">Entry</label>
      <select id="cpub-stagesub-entry" v-model="selectedEntryId" class="cpub-stagesub-input">
        <option v-for="e in eligibleEntries" :key="e.id" :value="e.id">{{ e.contentTitle }}</option>
      </select>
    </div>

    <ContestSubmissionField
      v-for="f in template"
      :key="f.key"
      :field="f"
      v-model="values[f.key]"
      id-prefix="cpub-stagesub"
    />

    <div class="cpub-stagesub-actions">
      <button
        type="button"
        class="cpub-btn cpub-btn-primary"
        :disabled="saving || !dirty || !selectedEntryId"
        @click="save"
      >
        <i class="fa-solid fa-paper-plane"></i>
        {{ saving ? 'Saving...' : existing ? 'Update submission' : 'Submit' }}
      </button>
      <span v-if="dirty && existing" class="cpub-stagesub-unsaved">Unsaved changes</span>
    </div>
  </section>
</template>

<style scoped>
.cpub-stagesub { border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 16px 20px; margin-bottom: 18px; }
.cpub-stagesub-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.cpub-stagesub-title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0; }
.cpub-stagesub-title i { color: var(--accent); }
.cpub-stagesub-badge { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border: var(--border-width-default) solid; }
.cpub-stagesub-done { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-stagesub-todo { color: var(--text-dim); border-color: var(--border2); background: var(--surface2); }
.cpub-stagesub-desc { font-size: 12px; color: var(--text-dim); margin: 0 0 12px; line-height: 1.6; }
.cpub-stagesub-intro { margin: 0 0 12px; }
.cpub-stagesub-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.cpub-stagesub-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.cpub-stagesub-req { color: var(--red); }
.cpub-stagesub-input { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-stagesub-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-stagesub-textarea { resize: vertical; }
.cpub-stagesub-help { font-size: 11px; color: var(--text-faint); margin: 0; }
.cpub-stagesub-actions { display: flex; align-items: center; gap: 10px; }
.cpub-stagesub-unsaved { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
