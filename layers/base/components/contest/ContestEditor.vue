<script setup lang="ts">
/**
 * ContestEditor — the one editor shell behind BOTH the create and edit routes
 * (`mode` prop). create.vue / [slug]/edit.vue are thin shells that mount this, so
 * creating a contest is identical to editing one (block body + canvas tabs + the
 * same settings), killing the old create/edit divergence.
 *
 * The editable form model lives in useContestEditor (tested in isolation). This
 * component is the shell: topbar, the full-width body canvas (ContestBodyTabs:
 * Overview/Rules/Prizes + Stages/Judging extra tabs), and the settings columns.
 * Edit-only rails (People, lifecycle transitions, advancement, danger zone) are
 * gated on `mode === 'edit'`; they operate on a persisted contest + real entries.
 */
import type { Serialized, ContestEntryItem } from '@commonpub/server';
import type { ContestEditorSource } from '../../composables/useContestEditor';

const props = defineProps<{ mode: 'create' | 'edit' }>();

const route = useRoute();
const toast = useToast();
const { extract: extractError } = useApiError();
const { user, isAdmin } = useAuth();

// Edit mode reads the contest slug from the route; create has none yet.
const slug = computed(() => (props.mode === 'edit' ? String(route.params.slug ?? '') : ''));

// Edit-mode fetch — lazy and `immediate:false` in create so it never fires there.
const { data: contest, refresh, status: contestStatus } = useLazyFetch(
  () => `/api/contests/${slug.value}`,
  { immediate: props.mode === 'edit' },
);
// useLazyFetch doesn't block navigation, so on a client-side nav `contest` is null
// until the fetch resolves. Treat idle/pending as "loading", not "not found".
const contestLoading = computed(() => props.mode === 'edit' && (contestStatus.value === 'idle' || contestStatus.value === 'pending'));
const isOwner = computed(() => isAdmin.value || !!(user.value?.id && contest.value?.createdById === user.value.id));
// Owner, a per-contest `editor`, or a `contest.manage` holder may edit. Owner-only
// surfaces (delete, collaborators) stay gated on `isOwner`. Create is always allowed
// (the route middleware + server policy gate who can reach it).
const canManage = computed(() => props.mode === 'create' || isOwner.value || !!contest.value?.viewerCanManage);

const editor = useContestEditor({
  mode: props.mode,
  slug: () => slug.value,
  toast: (m, k) => (k === 'success' ? toast.success(m) : toast.error(m)),
  extractError,
  navigate: (p) => navigateTo(p),
  refresh: () => refresh(),
  // Autosave renames swap the edit URL in place (same page component, no remount);
  // the hydrate guard below keeps the refetch from clobbering in-progress edits.
  onRenamed: (s) => navigateTo(`/contests/${s}/edit`, { replace: true }),
});
const {
  title, slugInput, slugTouched, subheading, descriptionBlocks, rulesBlocks, prizesBlocks,
  description, descriptionFormat, rules, rulesFormat, prizesDescription, prizesDescriptionFormat,
  bannerUrl, coverImageUrl, startDate, endDate, judgingEndDate, communityVotingEnabled,
  judgingVisibility, eligibleContentTypes, maxEntriesPerUser, visibility, visibleToRoles,
  showPrizes, prizes, criteria, stages, currentStageId,
  saving, formDirty, dateError, canSubmit, slugify, toggleType, toggleRole, addPrize, removePrize, prizeLabel, save,
} = editor;

// Draft contests autosave (background PUT once edits settle); published contests
// save on an explicit action. Create has no slug yet, so it never autosaves.
const isDraftAutosave = computed(() => props.mode === 'edit' && contest.value?.status === 'draft');
// Autosave retries on every keystroke after a failure, so toast each DISTINCT
// message once (else a persistent error, e.g. a slug conflict, spams every 3s
// while the organizer keeps typing). A successful save re-arms the toast.
const lastAutosaveError = ref('');
const autosave = useEditorAutosave({
  persist: () => editor.save({ silent: true }),
  canSave: () => isDraftAutosave.value && !dateError.value && !!title.value.trim(),
  debounceMs: 3000,
  onError: (err) => {
    const msg = extractError(err);
    if (msg !== lastAutosaveError.value) toast.error(msg);
    lastAutosaveError.value = msg;
  },
});
watch(autosave.status, (s) => { if (s === 'saved') lastAutosaveError.value = ''; });
// Any post-hydration edit re-arms the trailing debounce (only while autosaving).
watch(formDirty, (d) => { if (d && isDraftAutosave.value) autosave.markDirty(); });
const busy = computed(() => saving.value || autosave.saving.value);
const autosaveError = computed(() => autosave.status.value === 'error');
const autosaveLabel = computed(() => {
  if (busy.value) return 'Saving changes';
  if (autosaveError.value) return "Couldn't autosave";
  if (formDirty.value) return 'Unsaved changes';
  return 'All changes saved';
});
const autosaveIcon = computed(() => {
  if (busy.value) return 'fa-circle-notch fa-spin';
  if (autosaveError.value) return 'fa-triangle-exclamation';
  if (formDirty.value) return 'fa-circle';
  return 'fa-circle-check';
});
function onSave(): void {
  if (isDraftAutosave.value) void autosave.saveNow();
  else void save();
}

useSeoMeta({
  title: () => (props.mode === 'create'
    ? `Create Contest, ${useSiteName()}`
    : `Edit: ${contest.value?.title ?? 'Contest'}, ${useSiteName()}`),
});

const { enabledTypeMeta } = useContentTypes();
const ROLE_OPTIONS = ['member', 'pro', 'verified', 'staff', 'admin'];

// Extra full-width canvas tabs beside the body (Overview/Rules/Prizes): the heavy
// editors that need room. Light settings stay in the columns below.
const bodyExtraTabs = [
  { key: 'stages', label: 'Stages', icon: 'fa-diagram-project' },
  { key: 'judging', label: 'Judging', icon: 'fa-scale-balanced' },
];

// Edit-only advancement state (operates on real entries, not the editable model).
const advancing = ref<string | null>(null);
const advanceN = ref<Record<string, number>>({});
const advanceMode = ref<Record<string, 'topN' | 'manual'>>({});
const manualPick = ref<Record<string, string[]>>({});
const deleting = ref(false);

// Hydrate the form model when the contest loads (edit), and pre-fill each review
// stage's advancement cut from its persisted advanceCount.
watch(contest, (c) => {
  if (!c) return;
  // Never clobber unsaved edits with a refetch (e.g. an autosave rename swaps the
  // URL and re-fetches the renamed contest while the organizer keeps typing).
  if (formDirty.value) return;
  editor.hydrate(c as ContestEditorSource);
  advanceN.value = {};
  for (const s of stages.value) {
    if (s.kind === 'review' && typeof s.advanceCount === 'number') advanceN.value[s.id] = s.advanceCount;
  }
}, { immediate: true });

async function handleDelete(): Promise<void> {
  if (!confirm('Permanently delete this contest? All entries, judges, and reviewers are removed. This cannot be undone.')) return;
  deleting.value = true;
  try {
    await $fetch(`/api/contests/${slug.value}`, { method: 'DELETE' });
    toast.success('Contest deleted');
    await navigateTo('/contests');
  } catch (err: unknown) {
    toast.error(extractError(err));
    deleting.value = false;
  }
}

// Bidirectional lifecycle controls — the valid-transition map + button metadata
// live in utils/contestTransitions.ts (shared with ContestHero).
const availableTransitions = computed<string[]>(() => contestTransitionsFrom(contest.value?.status));
const statusAction = contestStatusAction;

async function transitionStatus(newStatus: string): Promise<void> {
  // Only the consequential transitions confirm; reversible nudges (pause/resume,
  // go-back) just apply.
  if (newStatus === 'cancelled' && !confirm('Cancel this contest? This cannot be undone.')) return;
  if (newStatus === 'completed' && !confirm('Complete this contest and publish results? Final rankings will be calculated.')) return;
  try {
    await $fetch(`/api/contests/${slug.value}/transition`, { method: 'POST', body: { status: newStatus } });
    toast.success(`Status changed to ${newStatus}`);
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}

// Advancement cuts operate on the PERSISTED stages (contest.value), not the
// editable `stages` ref, since they act on real entries.
const reviewStages = computed(() => (contest.value?.stages ?? []).filter((s) => s.kind === 'review'));
const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: Serialized<ContestEntryItem>[] }>(
  () => `/api/contests/${slug.value}/entries`,
  { immediate: props.mode === 'edit' },
);
const eligibleEntries = computed(() => (entriesData.value?.items ?? []).filter((e) => !e.eliminated));

function toggleManual(stageId: string, entryId: string): void {
  const cur = manualPick.value[stageId] ?? [];
  manualPick.value[stageId] = cur.includes(entryId) ? cur.filter((x) => x !== entryId) : [...cur, entryId];
}
async function advanceStageManual(stageId: string): Promise<void> {
  const ids = manualPick.value[stageId] ?? [];
  if (!ids.length) { toast.error('Select at least one entry to advance.'); return; }
  if (!confirm(`Advance the ${ids.length} selected ${ids.length === 1 ? 'entry' : 'entries'}? The rest of the cohort is marked "not advanced" and drops out of later judging + final results.`)) return;
  advancing.value = stageId;
  try {
    const r = await $fetch<{ advancedCount: number; eliminatedCount: number }>(`/api/contests/${slug.value}/advance`, {
      method: 'POST',
      body: { reviewStageId: stageId, mode: 'manual', advancedEntryIds: ids },
    });
    toast.success(`${r.advancedCount} advanced, ${r.eliminatedCount} not advanced.`);
    await Promise.all([refresh(), refreshEntries()]);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    advancing.value = null;
  }
}
async function advanceStage(stageId: string): Promise<void> {
  const topN = advanceN.value[stageId];
  if (!topN || topN < 1) { toast.error('Enter how many entries advance.'); return; }
  if (!confirm(`Advance the top ${topN} entries from this stage? Entries below the cut are marked "not advanced" and drop out of later judging + final results. You can re-run this.`)) return;
  advancing.value = stageId;
  try {
    const r = await $fetch<{ advancedCount: number; eliminatedCount: number }>(`/api/contests/${slug.value}/advance`, {
      method: 'POST',
      body: { reviewStageId: stageId, mode: 'topN', topN },
    });
    toast.success(`${r.advancedCount} advanced, ${r.eliminatedCount} not advanced.`);
    await Promise.all([refresh(), refreshEntries()]);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    advancing.value = null;
  }
}
</script>

<template>
  <!-- The editor is authed and entirely client-data-driven (its model hydrates from
       a client-side fetch), so SSR would render an unhydrated form and mismatch on
       hydration. Render it client-only with a loading fallback. -->
  <ClientOnly>
  <div v-if="mode === 'edit' && contest && !canManage" class="cpub-not-found">
    <p>You don't have permission to edit this contest.</p>
    <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
  </div>
  <div v-else-if="mode === 'create' || contest" class="cpub-contest-edit">
    <form class="cpub-edit-form" @submit.prevent="onSave">
      <div class="cpub-edit-topbar">
        <NuxtLink :to="mode === 'edit' ? `/contests/${slug}` : '/contests'" class="cpub-edit-topbar-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></NuxtLink>
        <div class="cpub-edit-topbar-titles">
          <span class="cpub-edit-topbar-title">{{ mode === 'create' ? 'Create Contest' : 'Edit Contest' }}</span>
          <span v-if="mode === 'edit' && contest" class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
          <span v-if="mode === 'create'" class="cpub-edit-required">Required: title, start &amp; end dates</span>
          <span
            v-else-if="isDraftAutosave"
            class="cpub-edit-autosave"
            :class="{ 'cpub-edit-autosave-err': autosaveError }"
            role="status"
            aria-live="polite"
          ><i class="fa-solid" :class="autosaveIcon"></i> {{ autosaveLabel }}</span>
          <span v-else-if="formDirty" class="cpub-edit-dirty"><i class="fa-solid fa-circle"></i> Unsaved</span>
        </div>
        <div class="cpub-edit-topbar-btns">
          <NuxtLink v-if="mode === 'edit'" :to="`/contests/${slug}`" class="cpub-btn">View</NuxtLink>
          <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="busy || !canSubmit">
            <i class="fa-solid" :class="mode === 'create' ? 'fa-trophy' : 'fa-floppy-disk'"></i>
            {{ busy ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create Contest' : (formDirty ? 'Save Changes' : 'Saved')) }}
          </button>
        </div>
      </div>

      <!-- Body canvas — full width so the block editor has room. -->
      <section class="cpub-form-section cpub-edit-body">
        <!-- Cover + banner shown as visual placeholders above the canvas (like the
             project/blog editors) so the organizer sees where each image appears. -->
        <ContestMediaStrip
          v-model:banner-url="bannerUrl"
          v-model:cover-image-url="coverImageUrl"
        />
        <h2 class="cpub-form-section-title cpub-edit-body-title">Contest body</h2>
        <ContestBodyTabs
          v-if="mode === 'create' || contest"
          v-model:description="descriptionBlocks"
          v-model:rules="rulesBlocks"
          v-model:prizes="prizesBlocks"
          :legacy-description="description"
          :legacy-description-format="descriptionFormat"
          :legacy-rules="rules"
          :legacy-rules-format="rulesFormat"
          :legacy-prizes="prizesDescription"
          :legacy-prizes-format="prizesDescriptionFormat"
          :extra-tabs="bodyExtraTabs"
        >
          <template #stages>
            <p class="cpub-form-hint">Optional. The standard flow (Submissions → Judging → Results) is derived from the schedule (Details &rsaquo; Schedule). Add custom stages for multi-round contests, proposal rounds, a Top-N selection, a build sprint, multiple judging rounds, or a showcase event.</p>
            <p class="cpub-form-hint">How the pieces fit: <strong>Stages</strong> are the public timeline entrants see. The <strong>Status</strong> control (right) is what's actually open right now (accepting entries / judging / completed). <strong>Advancement</strong> (below) runs each review round's Top-N cut. Mark a stage <strong>Current</strong> to point judges + the countdown at it.</p>
            <ContestStagesEditor
              v-model="stages"
              v-model:current-stage-id="currentStageId"
              :start-date="startDate"
              :end-date="endDate"
              :judging-end-date="judgingEndDate"
            />
            <section v-if="mode === 'edit' && reviewStages.length" class="cpub-form-section cpub-advance-section">
              <h2 class="cpub-form-section-title">Advancement</h2>
              <p class="cpub-form-hint">Multi-round contests: after judging a review stage, advance the top entries to the next stage. Entries below the cut are marked "not advanced" and excluded from later judging + final results. Re-running re-computes the cut. (Save any stage changes above first.)</p>
              <div v-for="rs in reviewStages" :key="rs.id" class="cpub-advance-block">
                <div class="cpub-advance-row">
                  <span class="cpub-advance-name"><i class="fa-solid fa-gavel"></i> {{ rs.name }}</span>
                  <div class="cpub-advance-mode">
                    <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="(advanceMode[rs.id] ?? 'topN') === 'topN'" @change="advanceMode[rs.id] = 'topN'" /> <span>Top N</span></label>
                    <label class="cpub-form-check"><input type="radio" :name="`mode-${rs.id}`" :checked="advanceMode[rs.id] === 'manual'" @change="advanceMode[rs.id] = 'manual'" /> <span>Pick manually</span></label>
                  </div>
                </div>
                <div v-if="(advanceMode[rs.id] ?? 'topN') === 'topN'" class="cpub-advance-ctl">
                  <label class="cpub-form-label" :for="`adv-${rs.id}`">Advance top</label>
                  <input :id="`adv-${rs.id}`" v-model.number="advanceN[rs.id]" type="number" min="1" class="cpub-form-input cpub-advance-n" placeholder="50" />
                  <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id" @click="advanceStage(rs.id)">
                    <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : 'Advance' }}
                  </button>
                </div>
                <div v-else class="cpub-advance-manual">
                  <p v-if="!eligibleEntries.length" class="cpub-form-hint" style="margin: 0;">No entries in the current cohort to pick from yet.</p>
                  <template v-else>
                    <label v-for="e in eligibleEntries" :key="e.id" class="cpub-advance-pick">
                      <input type="checkbox" :checked="(manualPick[rs.id] ?? []).includes(e.id)" @change="toggleManual(rs.id, e.id)" />
                      <span class="cpub-advance-pick-title">{{ e.contentTitle }}</span>
                      <span v-if="e.score != null" class="cpub-advance-pick-score">{{ e.score }}</span>
                    </label>
                    <button type="button" class="cpub-btn cpub-btn-sm" :disabled="advancing === rs.id || !(manualPick[rs.id] ?? []).length" @click="advanceStageManual(rs.id)">
                      <i class="fa-solid fa-arrow-up-right-dots"></i> {{ advancing === rs.id ? 'Advancing…' : `Advance ${(manualPick[rs.id] ?? []).length} selected` }}
                    </button>
                  </template>
                </div>
              </div>
            </section>
          </template>
          <template #judging>
            <div class="cpub-form-field">
              <label for="contest-judging-visibility" class="cpub-form-label">Score visibility</label>
              <select id="contest-judging-visibility" v-model="judgingVisibility" class="cpub-form-input">
                <option value="judges-only">Judges only, scores hidden until results</option>
                <option value="public">Public, show scores during judging</option>
                <option value="private">Private, scores stay with organizers</option>
              </select>
            </div>
            <label class="cpub-form-check"><input v-model="communityVotingEnabled" type="checkbox" /> <span>Enable community voting (advisory audience favourite, doesn't affect ranks)</span></label>
            <p class="cpub-form-hint" style="margin-top: 12px;">The rubric below is the contest's default criteria. A review stage can override it with per-round criteria (Stages tab). Leave it empty and judges score an overall 1 to 100.</p>
            <ContestCriteriaEditor v-model="criteria" label="Judging criteria" :show-total="true" />
          </template>
        </ContestBodyTabs>
        <p class="cpub-form-hint">Edit the <strong>Overview</strong>, <strong>Rules</strong>, <strong>Prizes</strong>, and <strong>Stages</strong> in the tabs above. The body copy is blocks (headings, lists, images, callouts, and the <strong>Judges Showcase</strong>), like the project and blog editors. Legacy text converts to blocks on first edit.</p>
      </section>

      <div class="cpub-edit-layout">
      <div class="cpub-edit-main">
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Details</h2>
        <div class="cpub-form-field">
          <label for="contest-title" class="cpub-form-label">Title</label>
          <input id="contest-title" v-model="title" type="text" class="cpub-form-input" :placeholder="mode === 'create' ? 'Maker Challenge 2026' : ''" />
        </div>
        <div class="cpub-form-field">
          <label for="contest-slug" class="cpub-form-label">URL Slug</label>
          <input id="contest-slug" v-model="slugInput" type="text" class="cpub-form-input" :placeholder="mode === 'create' ? 'auto-generated from title' : ''" @input="slugTouched = true" @blur="slugInput = slugify(slugInput)" />
          <p class="cpub-form-hint">The contest URL: <code>/contests/{{ slugify(slugInput) || 'your-contest' }}</code>. {{ mode === 'create' ? 'Auto-fills from the title.' : 'Changing it breaks old links, they won\'t redirect.' }}</p>
        </div>
        <div class="cpub-form-field">
          <label for="contest-subheading" class="cpub-form-label">Subheading</label>
          <input id="contest-subheading" v-model="subheading" type="text" maxlength="300" class="cpub-form-input" placeholder="One-line tagline shown in the contest header" />
          <p class="cpub-form-hint">Short plain-text tagline shown under the title in the hero. The Contest body above is the full content. The banner and cover images are set above the body canvas.</p>
        </div>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Schedule</h2>
        <div class="cpub-form-row">
          <CpubDateTimeField label="Start Date" :model-value="startDate" :required="mode === 'create'" @update:model-value="startDate = $event ?? ''" />
          <CpubDateTimeField label="End Date" :model-value="endDate" :min="startDate || undefined" :required="mode === 'create'" @update:model-value="endDate = $event ?? ''" />
        </div>
        <div class="cpub-form-field">
          <CpubDateTimeField label="Judging End Date" :model-value="judgingEndDate" :min="endDate || undefined" @update:model-value="judgingEndDate = $event ?? ''" />
        </div>
        <p v-if="dateError" class="cpub-form-error" role="alert">{{ dateError }}</p>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Prizes</h2>
        <label class="cpub-form-check" style="margin-bottom: 10px;">
          <input v-model="showPrizes" type="checkbox" />
          <span>Show the Prizes tab on the contest page</span>
        </label>
        <p v-if="!showPrizes" class="cpub-form-hint">The Prizes tab is hidden, any prizes below are saved but not shown to visitors.</p>
        <p class="cpub-form-hint">Every field is optional. Use <strong>place</strong> for ranked prizes, a <strong>category</strong> for themed awards, or just a <strong>description</strong>, whatever fits. Cash value is optional. The prizes <em>overview</em> copy is edited in the Contest body &rsaquo; Prizes tab above.</p>
        <div v-for="(prize, i) in prizes" :key="i" class="cpub-prize-row">
          <div class="cpub-prize-header">
            <span class="cpub-prize-label">{{ prizeLabel(prize) }}</span>
            <button type="button" class="cpub-prize-remove" aria-label="Remove prize" @click="removePrize(i)"><i class="fa-solid fa-times"></i></button>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field">
              <label :for="`prize-place-${i}`" class="cpub-form-label">Place</label>
              <input :id="`prize-place-${i}`" v-model.number="prize.place" type="number" min="1" class="cpub-form-input" placeholder="1" />
            </div>
            <div class="cpub-form-field">
              <label :for="`prize-category-${i}`" class="cpub-form-label">Category (optional)</label>
              <input :id="`prize-category-${i}`" v-model="prize.category" type="text" class="cpub-form-input" placeholder="e.g. Best in Show" />
            </div>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field">
              <label :for="`prize-title-${i}`" class="cpub-form-label">Title</label>
              <input :id="`prize-title-${i}`" v-model="prize.title" type="text" class="cpub-form-input" placeholder="e.g. Gold Prize" />
            </div>
            <div class="cpub-form-field">
              <label :for="`prize-value-${i}`" class="cpub-form-label">Value</label>
              <input :id="`prize-value-${i}`" v-model="prize.value" type="text" class="cpub-form-input" placeholder="e.g. $500" />
            </div>
          </div>
          <div class="cpub-form-field">
            <label :for="`prize-desc-${i}`" class="cpub-form-label">Description</label>
            <input :id="`prize-desc-${i}`" v-model="prize.description" type="text" class="cpub-form-input" placeholder="Optional description" />
          </div>
        </div>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize"><i class="fa-solid fa-plus"></i> Add Prize</button>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Visibility &amp; Access</h2>
        <div class="cpub-form-field">
          <label for="contest-visibility" class="cpub-form-label">Who can see this contest</label>
          <select id="contest-visibility" v-model="visibility" class="cpub-form-input">
            <option value="public">Public, listed and visible to everyone</option>
            <option value="unlisted">Unlisted, visible by direct link, hidden from listings</option>
            <option value="private">Private, restricted</option>
          </select>
        </div>
        <div v-if="visibility === 'private'" class="cpub-form-field">
          <span class="cpub-form-label">Also visible to roles</span>
          <p v-if="mode === 'create'" class="cpub-form-hint">Owner, admins, judges, and reviewers (added after creation) can always see it. Optionally grant whole roles too.</p>
          <div class="cpub-type-options" role="group" aria-label="Roles that can view">
            <label v-for="r in ROLE_OPTIONS" :key="r" class="cpub-form-check">
              <input type="checkbox" :checked="visibleToRoles.includes(r)" @change="toggleRole(r)" />
              <span>{{ r }}</span>
            </label>
          </div>
        </div>
        <p v-if="mode === 'create' && visibility === 'private'" class="cpub-form-hint">Add named reviewers (stakeholders) from the contest's Edit page after creating it.</p>
      </section>
      </div><!-- /cpub-edit-main -->

      <aside class="cpub-edit-side">
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Entries</h2>
        <div class="cpub-form-field">
          <span class="cpub-form-label">Eligible content types</span>
          <p class="cpub-form-hint">Leave all unchecked to accept any published content the entrant owns.</p>
          <div class="cpub-type-options" role="group" aria-label="Eligible content types">
            <label v-for="t in enabledTypeMeta" :key="t.type" class="cpub-form-check">
              <input type="checkbox" :checked="eligibleContentTypes.includes(t.type)" @change="toggleType(t.type)" />
              <span>{{ t.label }}</span>
            </label>
          </div>
        </div>
        <div class="cpub-form-field">
          <label for="contest-max-entries" class="cpub-form-label">Max entries per person</label>
          <input id="contest-max-entries" v-model.number="maxEntriesPerUser" type="number" min="1" class="cpub-form-input" placeholder="Unlimited" />
        </div>
      </section>

      <section v-if="mode === 'edit'" class="cpub-form-section">
        <h2 class="cpub-form-section-title">People</h2>
        <ContestJudgeManager :contest-slug="slug" :is-owner="isOwner" />
        <div v-if="isOwner" class="cpub-people-collab">
          <h3 class="cpub-form-subtitle">Collaborators</h3>
          <p class="cpub-form-hint">Per-contest access only (no system-wide). Reviewers can view, even while private or draft; editors can edit.</p>
          <ContestStakeholderManager :contest-slug="slug" />
        </div>
      </section>
      <section v-else class="cpub-form-section cpub-people-placeholder">
        <h2 class="cpub-form-section-title">People</h2>
        <p class="cpub-form-hint">Add judges, reviewers, and collaborators from the contest's Edit page once it's created.</p>
      </section>

      <section v-if="mode === 'edit' && contest" class="cpub-form-section">
        <h2 class="cpub-form-section-title">Stage &amp; Status</h2>
        <p class="cpub-form-hint">
          A contest runs through <strong>Draft</strong> → <strong>Upcoming</strong> →
          <strong>Active</strong> (accepting entries) → <strong>Judging</strong> →
          <strong>Completed</strong>. You can move <em>backwards</em>, <strong>Pause</strong> to
          temporarily stop submissions without cancelling, resume later, or cancel. Current status:
          <span class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
        </p>
        <div class="cpub-status-actions">
          <button
            v-for="t in availableTransitions"
            :key="t"
            type="button"
            class="cpub-btn cpub-transition-btn"
            :class="{
              'cpub-transition-activate': statusAction(t).tone === 'go',
              'cpub-transition-judging': statusAction(t).tone === 'warn',
              'cpub-transition-cancel': statusAction(t).tone === 'danger',
            }"
            @click="transitionStatus(t)"
          >
            <i class="fa-solid" :class="statusAction(t).icon"></i> {{ statusAction(t).label }}
          </button>
          <p v-if="!availableTransitions.length" class="cpub-status-terminal">
            <i class="fa-solid fa-circle-check"></i>
            No status changes available from <strong>{{ contest.status }}</strong>.
          </p>
        </div>
      </section>

      <section v-if="mode === 'edit' && isOwner" class="cpub-form-section cpub-danger-zone">
        <h2 class="cpub-form-section-title cpub-danger-title">Danger Zone</h2>
        <div class="cpub-danger-row">
          <div>
            <p class="cpub-danger-label">Delete this contest</p>
            <p class="cpub-form-hint">Permanently removes the contest and all of its entries, judges, and reviewers. This cannot be undone.</p>
          </div>
          <button type="button" class="cpub-btn cpub-btn-danger cpub-danger-btn" :disabled="deleting" @click="handleDelete">
            <i class="fa-solid fa-trash"></i> {{ deleting ? 'Deleting...' : 'Delete Contest' }}
          </button>
        </div>
      </section>
      </aside><!-- /cpub-edit-side -->
      </div><!-- /cpub-edit-layout -->

    </form>
  </div>
  <div v-else-if="contestLoading" class="cpub-not-found"><p>Loading contest…</p></div>
  <div v-else class="cpub-not-found"><p>Contest not found</p></div>
    <template #fallback>
      <div class="cpub-not-found"><p>Loading editor…</p></div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.cpub-contest-edit { max-width: 1080px; margin: 0 auto; padding: 32px; }
/* Editor topbar: back + title + status + actions, sticky to the top while editing. */
.cpub-edit-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; padding: 12px 0; margin: -8px 0 4px; background: var(--bg); border-bottom: var(--border-width-default) solid var(--border); }
.cpub-edit-topbar-back { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text-dim); text-decoration: none; flex-shrink: 0; }
.cpub-edit-topbar-back:hover { border-color: var(--accent); color: var(--accent); }
.cpub-edit-topbar-titles { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.cpub-edit-topbar-title { font-size: 16px; font-weight: 700; }
.cpub-edit-topbar-btns { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cpub-edit-required { font-size: 11px; color: var(--text-faint); }
.cpub-people-collab { margin-top: 16px; padding-top: 12px; border-top: var(--border-width-default) solid var(--border2); }

.cpub-status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-default) solid; }
.cpub-status-draft { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); border-style: dashed; }
.cpub-status-upcoming { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-paused { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }
.cpub-status-cancelled { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }

.cpub-edit-form { display: flex; flex-direction: column; gap: 16px; }
/* Two-column editor: wide content column + a sticky meta rail (Entries, People,
   Stage & Status, Danger Zone) so lifecycle controls stay reachable while editing. */
.cpub-edit-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.cpub-edit-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.cpub-edit-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 76px; }
.cpub-form-section { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 20px; box-shadow: var(--shadow-md); }
.cpub-form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
.cpub-edit-body-title { margin-top: 20px; }
.cpub-form-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
.cpub-field-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }
.cpub-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }

.cpub-form-error { font-size: 12px; color: var(--red); margin-top: 8px; }
.cpub-form-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
.cpub-form-check input { width: 14px; height: 14px; }
.cpub-type-options { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; }
.cpub-form-subtitle { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; }
.cpub-form-hint { font-size: 11px; color: var(--text-faint); margin: 0 0 12px; line-height: 1.5; }

.cpub-prize-row { border: var(--border-width-default) solid var(--border); padding: 14px; margin-bottom: 10px; background: var(--surface2); }
.cpub-prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpub-prize-label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.cpub-prize-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; }
.cpub-prize-remove:hover { color: var(--red); }

.cpub-status-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.cpub-transition-btn { display: inline-flex; align-items: center; gap: 6px; }
.cpub-transition-activate { color: var(--green); border-color: var(--green-border); }
.cpub-transition-judging { color: var(--yellow); border-color: var(--yellow-border); }
.cpub-transition-complete { color: var(--accent); border-color: var(--accent-border); }
.cpub-transition-cancel { color: var(--red); border-color: var(--red-border); }

.cpub-status-terminal { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 8px; margin: 0; }
.cpub-status-terminal i { color: var(--green); }

.cpub-danger-zone { border-color: var(--red-border); }
.cpub-danger-title { color: var(--red); }
.cpub-danger-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.cpub-danger-label { font-size: 13px; font-weight: 600; margin: 0 0 2px; }
.cpub-danger-btn { color: var(--red); border-color: var(--red-border); flex-shrink: 0; }
.cpub-danger-btn:hover:not(:disabled) { background: var(--red-bg); }

.cpub-not-found { text-align: center; padding: 64px; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 12px; }

.cpub-advance-block { padding: 12px 0; border-top: var(--border-width-default) solid var(--border); }
.cpub-advance-block:first-of-type { border-top: 0; }
.cpub-advance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cpub-advance-name { font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
.cpub-advance-name i { color: var(--accent); font-size: 11px; }
.cpub-advance-mode { display: inline-flex; gap: 12px; }
.cpub-advance-ctl { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; }
.cpub-advance-ctl .cpub-form-label { margin: 0; }
.cpub-advance-n { width: 80px; }
.cpub-advance-manual { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.cpub-advance-pick { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); padding: 4px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface2); cursor: pointer; }
.cpub-advance-pick-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-advance-pick-score { font-family: var(--font-mono); font-size: 11px; color: var(--accent); flex-shrink: 0; }
.cpub-advance-manual .cpub-btn { align-self: flex-start; margin-top: 6px; }
.cpub-edit-dirty { color: var(--accent); display: inline-flex; align-items: center; gap: 5px; }
.cpub-edit-dirty i { font-size: 6px; }
.cpub-edit-autosave { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-faint); }
.cpub-edit-autosave i { font-size: 9px; }
.cpub-edit-autosave-err { color: var(--red); }

/* Collapse the meta rail under the main column on narrower viewports. */
@media (max-width: 900px) {
  .cpub-edit-layout { grid-template-columns: 1fr; }
  .cpub-edit-side { position: static; }
}
@media (max-width: 768px) {
  .cpub-contest-edit { padding: 16px; }
  .cpub-form-row { grid-template-columns: 1fr; }
}
</style>
