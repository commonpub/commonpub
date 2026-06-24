<script setup lang="ts">
import type { ContestStage } from '@commonpub/schema';
import { blockingFields, buildSubmissionPayload } from '../../utils/contestSubmission';

// Form-first proposal entry (Phase 4). For a current, proposal-mode submission
// stage: the entrant fills the stage form and the server creates a DRAFT
// placeholder project linked as their entry, then routes them into the editor.
// Gated by features.contestProposals at the route; shown by the parent page only
// when the current stage is proposal-mode.

const props = defineProps<{
  contestSlug: string;
  /** The current proposal-mode submission stage (carries the template). */
  stage: ContestStage;
}>();

const emit = defineEmits<{ (e: 'submitted', projectSlug: string, contentType: string): void }>();

const toast = useToast();
const { extract: extractError } = useApiError();

const template = computed(() => props.stage.submissionTemplate ?? []);
const instructions = computed(() => (props.stage.instructionsBlocks ?? []) as [string, Record<string, unknown>][]);
const values = ref<Record<string, string>>({});
watch(template, (t) => {
  const next: Record<string, string> = {};
  for (const f of t) next[f.key] = '';
  values.value = next;
}, { immediate: true });

const missingRequired = computed(() => blockingFields(template.value, values.value));
const submitting = ref(false);

async function submit(): Promise<void> {
  if (submitting.value) return;
  if (missingRequired.value.length) {
    toast.error(`Please complete: ${missingRequired.value.join(', ')}`);
    return;
  }
  submitting.value = true;
  try {
    const fields = buildSubmissionPayload(template.value, values.value);
    const res = await $fetch<{ entryId: string; projectSlug: string; contentType: string }>(
      `/api/contests/${props.contestSlug}/proposal`,
      { method: 'POST', body: { stageId: props.stage.id, fields } },
    );
    toast.success('Proposal submitted. Continue building your project for the next round.');
    emit('submitted', res.projectSlug, res.contentType);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section v-if="template.length" class="cpub-proposal" :aria-label="`${stage.name} proposal form`">
    <div class="cpub-proposal-head">
      <h3 class="cpub-proposal-title"><i class="fa-solid fa-clipboard-list"></i> {{ stage.name }}: submit a proposal</h3>
    </div>
    <p v-if="stage.description" class="cpub-proposal-desc">{{ stage.description }}</p>
    <BlocksBlockContentRenderer v-if="instructions.length" :blocks="instructions" class="cpub-prose cpub-md cpub-proposal-intro" />
    <p class="cpub-proposal-desc">Submitting creates a draft project you can develop for later rounds. You can edit it any time.</p>

    <ContestSubmissionField
      v-for="f in template"
      :key="f.key"
      :field="f"
      v-model="values[f.key]"
      id-prefix="cpub-proposal"
    />

    <div class="cpub-proposal-actions">
      <button type="button" class="cpub-btn cpub-btn-primary" :disabled="submitting" @click="submit">
        <i class="fa-solid fa-paper-plane"></i>
        {{ submitting ? 'Submitting...' : 'Submit proposal' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.cpub-proposal { border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); padding: 16px 20px; margin-bottom: 18px; }
.cpub-proposal-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.cpub-proposal-title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0; }
.cpub-proposal-title i { color: var(--accent); }
.cpub-proposal-desc { font-size: 12px; color: var(--text-dim); margin: 0 0 12px; line-height: 1.6; }
.cpub-proposal-intro { margin: 0 0 12px; }
.cpub-proposal-actions { display: flex; align-items: center; gap: 10px; }
</style>
