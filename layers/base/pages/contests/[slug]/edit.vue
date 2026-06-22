<script setup lang="ts">
import type { ContestStage } from '@commonpub/schema';
import type { Serialized, ContestEntryItem } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { extract: extractError } = useApiError();
const { user, isAdmin } = useAuth();

const { data: contest, refresh, status: contestStatus } = useLazyFetch(`/api/contests/${slug}`);
// `useLazyFetch` doesn't block navigation, so on a client-side nav (clicking
// "Edit Contest") `contest` is null until the fetch resolves. Without this we'd
// render the "Contest not found" branch during that window — which reads as a
// broken link. Treat idle/pending as "loading", not "not found".
const contestLoading = computed(() => contestStatus.value === 'idle' || contestStatus.value === 'pending');
const isOwner = computed(() => isAdmin.value || !!(user.value?.id && contest.value?.createdById === user.value.id));
// Can the viewer edit this contest? Owner, a per-contest `editor`, or a
// `contest.manage` holder (server-computed `viewerCanManage`). Drives page access
// + the editing surface. Owner-only surfaces (delete, managing collaborators)
// stay gated on `isOwner`.
const canManage = computed(() => isOwner.value || !!contest.value?.viewerCanManage);
useSeoMeta({ title: () => `Edit: ${contest.value?.title ?? 'Contest'}, ${useSiteName()}` });

const saving = ref(false);
const title = ref('');
// Editable slug — initialised from the loaded contest, manual override allowed.
const slugInput = ref('');
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+)|(-+$)/g, '').slice(0, 255);
}
const subheading = ref('');
const description = ref('');
// Block-editor body (BlockTuple[]); when set, the viewer renders it instead of the
// legacy `description` text. Null until the contest loads (seeded by ContestBodyEditor).
const descriptionBlocks = ref<unknown[] | null>(null);
const rulesBlocks = ref<unknown[] | null>(null);
const prizesBlocks = ref<unknown[] | null>(null);
const rules = ref('');
// Per-field render mode: Markdown (default) or raw HTML, independent per field.
const descriptionFormat = ref<'markdown' | 'html'>('markdown');
const rulesFormat = ref<'markdown' | 'html'>('markdown');
const prizesDescriptionFormat = ref<'markdown' | 'html'>('markdown');
const bannerUrl = ref('');
const coverImageUrl = ref('');
const startDate = ref('');
const endDate = ref('');
const judgingEndDate = ref('');
const communityVotingEnabled = ref(false);
const judgingVisibility = ref<'public' | 'judges-only' | 'private'>('judges-only');

const { enabledTypeMeta } = useContentTypes();
const eligibleContentTypes = ref<string[]>([]);
const maxEntriesPerUser = ref<number | null>(null);
function toggleType(type: string): void {
  const i = eligibleContentTypes.value.indexOf(type);
  if (i >= 0) eligibleContentTypes.value.splice(i, 1);
  else eligibleContentTypes.value.push(type);
}

const visibility = ref<'public' | 'unlisted' | 'private'>('public');
const visibleToRoles = ref<string[]>([]);
const ROLE_OPTIONS = ['member', 'pro', 'verified', 'staff', 'admin'];
function toggleRole(r: string): void {
  const i = visibleToRoles.value.indexOf(r);
  if (i >= 0) visibleToRoles.value.splice(i, 1);
  else visibleToRoles.value.push(r);
}

const showPrizes = ref(true);
const prizesDescription = ref('');
interface Prize { place: number | null; category: string; title: string; description: string; value: string }
const prizes = ref<Prize[]>([]);

interface Criterion { label: string; weight: number | null; description: string }
const criteria = ref<Criterion[]>([]);

// Phase B1 — explicit stage timeline (empty ⇒ standard synthesized flow).
const stages = ref<ContestStage[]>([]);
const currentStageIdRef = ref<string | null>(null);
// Declared before the contest loader (below) since the loader pre-fills advanceN.
const advancing = ref<string | null>(null);
const advanceN = ref<Record<string, number>>({});

// Dirty tracking: any edit after the contest loads flips this so the save bar
// shows "unsaved changes" — feedback that a change (e.g. checking an eligible
// type) registered. `hydratingForm` suppresses the watcher while the loader
// populates the fields from the fetched contest.
const formDirty = ref(false);
let hydratingForm = false;

// Load current data
watch(contest, (c) => {
  if (!c) return;
  hydratingForm = true;
  title.value = c.title ?? '';
  slugInput.value = c.slug ?? '';
  subheading.value = c.subheading ?? '';
  description.value = c.description ?? '';
  descriptionBlocks.value = (c.descriptionBlocks as unknown[] | null) ?? null;
  rulesBlocks.value = (c.rulesBlocks as unknown[] | null) ?? null;
  prizesBlocks.value = (c.prizesBlocks as unknown[] | null) ?? null;
  rules.value = c.rules ?? '';
  descriptionFormat.value = (c.descriptionFormat as 'markdown' | 'html') ?? 'markdown';
  rulesFormat.value = (c.rulesFormat as 'markdown' | 'html') ?? 'markdown';
  prizesDescriptionFormat.value = (c.prizesDescriptionFormat as 'markdown' | 'html') ?? 'markdown';
  bannerUrl.value = c.bannerUrl ?? '';
  coverImageUrl.value = c.coverImageUrl ?? '';
  // Local wall-clock for the datetime-local inputs (toISOString would show UTC,
  // shifting the displayed time by the local offset). Shared offset-correct util.
  startDate.value = toLocalInput(c.startDate);
  endDate.value = toLocalInput(c.endDate);
  judgingEndDate.value = toLocalInput(c.judgingEndDate);
  communityVotingEnabled.value = !!c.communityVotingEnabled;
  judgingVisibility.value = (c.judgingVisibility as typeof judgingVisibility.value) ?? 'judges-only';
  eligibleContentTypes.value = [...(c.eligibleContentTypes ?? [])];
  maxEntriesPerUser.value = c.maxEntriesPerUser ?? null;
  visibility.value = (c.visibility as typeof visibility.value) ?? 'public';
  visibleToRoles.value = [...(c.visibleToRoles ?? [])];
  showPrizes.value = c.showPrizes !== false;
  stages.value = Array.isArray(c.stages) ? [...c.stages] : [];
  currentStageIdRef.value = c.currentStageId ?? null;
  // Pre-fill the Advancement control from each review stage's defined cut.
  for (const s of stages.value) {
    if (s.kind === 'review' && typeof s.advanceCount === 'number') advanceN.value[s.id] = s.advanceCount;
  }
  prizesDescription.value = c.prizesDescription ?? '';
  prizes.value = (c.prizes ?? []).map((p: { place?: number; category?: string; title?: string; description?: string; value?: string }) => ({
    place: p.place ?? null,
    category: p.category ?? '',
    title: p.title ?? '',
    description: p.description ?? '',
    value: p.value ?? '',
  }));
  criteria.value = (c.judgingCriteria ?? []).map((cr: { label: string; weight?: number; description?: string }) => ({
    label: cr.label,
    weight: cr.weight ?? null,
    description: cr.description ?? '',
  }));
  // Let the field watchers settle from this hydration, then re-arm dirty tracking.
  void nextTick(() => { hydratingForm = false; });
}, { immediate: true });

// Mark the form dirty on any post-hydration edit (gives the save bar its
// "unsaved changes" cue). Worst case (timing) is a harmless early "dirty".
watch(
  [title, slugInput, subheading, description, descriptionBlocks, rulesBlocks, prizesBlocks, rules, descriptionFormat, rulesFormat, prizesDescriptionFormat, bannerUrl, coverImageUrl, startDate, endDate, judgingEndDate,
    communityVotingEnabled, judgingVisibility, eligibleContentTypes, maxEntriesPerUser, visibility, visibleToRoles,
    showPrizes, stages, currentStageIdRef, prizesDescription, prizes, criteria],
  () => { if (!hydratingForm) formDirty.value = true; },
  { deep: true },
);

function addPrize(): void {
  prizes.value.push({ place: null, category: '', title: '', description: '', value: '' });
}
function removePrize(index: number): void {
  prizes.value.splice(index, 1);
}
function prizeLabel(prize: Prize): string {
  if (prize.category.trim()) return prize.category;
  if (prize.place && prize.place > 0) {
    const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    return `${labels[prize.place - 1] || `${prize.place}th`} Place`;
  }
  // No place + no category: a flexible/description-only prize — don't invent
  // a placement (the old code labelled these "Nth Place" by row index).
  return 'Prize';
}

function addCriterion(): void {
  criteria.value.push({ label: '', weight: null, description: '' });
}
function removeCriterion(index: number): void {
  criteria.value.splice(index, 1);
}
const criteriaTotal = computed(() => criteria.value.reduce((s, c) => s + (c.weight ?? 0), 0));

const dateError = computed(() => {
  if (startDate.value && endDate.value && new Date(endDate.value) <= new Date(startDate.value)) {
    return 'End date must be after the start date.';
  }
  if (judgingEndDate.value && endDate.value && new Date(judgingEndDate.value) < new Date(endDate.value)) {
    return 'Judging end date must be on or after the end date.';
  }
  return '';
});

async function handleSave(): Promise<void> {
  if (dateError.value) { toast.error(dateError.value); return; }
  saving.value = true;
  try {
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
        description: c.description.trim() || undefined,
      }));

    const updated = await $fetch<{ slug: string }>(`/api/contests/${slug}`, {
      method: 'PUT',
      body: {
        title: title.value,
        slug: slugify(slugInput.value) || undefined,
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
        startDate: startDate.value ? new Date(startDate.value).toISOString() : undefined,
        endDate: endDate.value ? new Date(endDate.value).toISOString() : undefined,
        judgingEndDate: judgingEndDate.value ? new Date(judgingEndDate.value).toISOString() : undefined,
        communityVotingEnabled: communityVotingEnabled.value,
        judgingVisibility: judgingVisibility.value,
        eligibleContentTypes: eligibleContentTypes.value,
        maxEntriesPerUser: maxEntriesPerUser.value && maxEntriesPerUser.value > 0 ? maxEntriesPerUser.value : undefined,
        visibility: visibility.value,
        visibleToRoles: visibility.value === 'private' ? visibleToRoles.value : [],
        showPrizes: showPrizes.value,
        stages: stages.value,
        currentStageId: currentStageIdRef.value ?? undefined,
        prizesDescription: prizesDescription.value || undefined,
        prizes: prizeData,
        judgingCriteria: criteriaData,
      },
    });
    toast.success('Contest updated');
    formDirty.value = false;
    // Slug changed → the old URL no longer resolves. Navigate to the renamed
    // contest's page — a different route component, so it loads fresh. (Navigating
    // to the new /edit URL would reuse THIS component with its stale fetch key.)
    if (updated?.slug && updated.slug !== slug) {
      await navigateTo(`/contests/${updated.slug}`);
      return;
    }
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}

const deleting = ref(false);
async function handleDelete(): Promise<void> {
  if (!confirm('Permanently delete this contest? All entries, judges, and reviewers are removed. This cannot be undone.')) return;
  deleting.value = true;
  try {
    await $fetch(`/api/contests/${slug}`, { method: 'DELETE' });
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

// Phase B2 — advancement cuts. Operates on the PERSISTED stages (contest.value),
// not the editable `stages` ref, since it acts on real entries.
const reviewStages = computed(() => (contest.value?.stages ?? []).filter((s) => s.kind === 'review'));

// Entries (the cohort) — for the manual advancement picker. The eligible set is
// everyone not already eliminated by a prior round's cut.
const { data: entriesData, refresh: refreshEntries } = useLazyFetch<{ items: Serialized<ContestEntryItem>[] }>(`/api/contests/${slug}/entries`);
const eligibleEntries = computed(() => (entriesData.value?.items ?? []).filter((e) => !e.eliminated));
const advanceMode = ref<Record<string, 'topN' | 'manual'>>({});
const manualPick = ref<Record<string, string[]>>({});
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
    const r = await $fetch<{ advancedCount: number; eliminatedCount: number }>(`/api/contests/${slug}/advance`, {
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
    const r = await $fetch<{ advancedCount: number; eliminatedCount: number }>(`/api/contests/${slug}/advance`, {
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

async function transitionStatus(newStatus: string): Promise<void> {
  // Only the consequential transitions confirm; reversible nudges (pause/resume,
  // go-back) just apply.
  if (newStatus === 'cancelled' && !confirm('Cancel this contest? This cannot be undone.')) return;
  if (newStatus === 'completed' && !confirm('Complete this contest and publish results? Final rankings will be calculated.')) return;
  try {
    await $fetch(`/api/contests/${slug}/transition`, { method: 'POST', body: { status: newStatus } });
    toast.success(`Status changed to ${newStatus}`);
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}
</script>

<template>
  <div v-if="contest && !canManage" class="cpub-not-found">
    <p>You don't have permission to edit this contest.</p>
    <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
  </div>
  <div v-else-if="contest" class="cpub-contest-edit">
    <NuxtLink :to="`/contests/${slug}`" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Back to contest</NuxtLink>
    <h1 class="cpub-edit-title">Edit Contest</h1>
    <p class="cpub-edit-subtitle">
      Status: <span class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
    </p>

    <form class="cpub-edit-form" @submit.prevent="handleSave">
      <div class="cpub-edit-layout">
      <div class="cpub-edit-main">
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Details</h2>
        <div class="cpub-form-field">
          <label for="contest-title" class="cpub-form-label">Title</label>
          <input id="contest-title" v-model="title" type="text" class="cpub-form-input" />
        </div>
        <div class="cpub-form-field">
          <label for="contest-slug" class="cpub-form-label">URL Slug</label>
          <input id="contest-slug" v-model="slugInput" type="text" class="cpub-form-input" @blur="slugInput = slugify(slugInput)" />
          <p class="cpub-form-hint">The contest URL: <code>/contests/{{ slugify(slugInput) || 'your-contest' }}</code>. Changing it breaks old links, they won't redirect.</p>
        </div>
        <div class="cpub-form-field">
          <label for="contest-subheading" class="cpub-form-label">Subheading</label>
          <input id="contest-subheading" v-model="subheading" type="text" maxlength="300" class="cpub-form-input" placeholder="One-line tagline shown in the contest header" />
          <p class="cpub-form-hint">Short plain-text tagline shown under the title in the hero. The Description below is the full body.</p>
        </div>
        <div class="cpub-form-field">
          <div class="cpub-form-label">Contest body</div>
          <ContestBodyTabs
            v-if="contest"
            v-model:description="descriptionBlocks"
            v-model:rules="rulesBlocks"
            v-model:prizes="prizesBlocks"
            :legacy-description="description"
            :legacy-description-format="descriptionFormat"
            :legacy-rules="rules"
            :legacy-rules-format="rulesFormat"
            :legacy-prizes="prizesDescription"
            :legacy-prizes-format="prizesDescriptionFormat"
          />
          <p class="cpub-form-hint">Edit the <strong>Overview</strong>, <strong>Rules</strong>, and <strong>Prizes</strong> copy as blocks (headings, lists, images, callouts, and the <strong>Judges Showcase</strong>), like the project and blog editors. Legacy text converts to blocks on first edit.</p>
        </div>
        <div class="cpub-form-field">
          <ImageUpload v-model="bannerUrl" purpose="banner" label="Banner Image" hint="Wide hero image across the top of the contest page (~4:1)." />
        </div>
        <div class="cpub-form-field">
          <ImageUpload v-model="coverImageUrl" purpose="cover" label="Cover Image (optional)" hint="Card/thumbnail image shown in listings (~4:3). Falls back to the banner if unset." />
        </div>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Schedule</h2>
        <div class="cpub-form-row">
          <div class="cpub-form-field">
            <label for="contest-start" class="cpub-form-label">Start Date</label>
            <input id="contest-start" v-model="startDate" type="datetime-local" class="cpub-form-input" />
          </div>
          <div class="cpub-form-field">
            <label for="contest-end" class="cpub-form-label">End Date</label>
            <input id="contest-end" v-model="endDate" type="datetime-local" class="cpub-form-input" />
          </div>
        </div>
        <div class="cpub-form-field">
          <label for="contest-judging-end" class="cpub-form-label">Judging End Date</label>
          <input id="contest-judging-end" v-model="judgingEndDate" type="datetime-local" class="cpub-form-input" />
        </div>
        <p v-if="dateError" class="cpub-form-error" role="alert">{{ dateError }}</p>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Stages</h2>
        <p class="cpub-form-hint">Optional. The standard flow (Submissions → Judging → Results) is derived from the schedule above. Add custom stages for multi-round contests, proposal rounds, a Top-N selection, a build sprint, multiple judging rounds, or a showcase event.</p>
        <p class="cpub-form-hint">How the pieces fit: <strong>Stages</strong> are the public timeline entrants see. The <strong>Status</strong> control (right) is what's actually open right now (accepting entries / judging / completed). <strong>Advancement</strong> (below) runs each review round's Top-N cut. Mark a stage <strong>Current</strong> to point judges + the countdown at it.</p>
        <ContestStagesEditor
          v-model="stages"
          v-model:current-stage-id="currentStageIdRef"
          :start-date="startDate"
          :end-date="endDate"
          :judging-end-date="judgingEndDate"
        />
      </section>

      <section v-if="reviewStages.length" class="cpub-form-section">
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
        <h2 class="cpub-form-section-title">Judging</h2>
        <div class="cpub-form-field">
          <label for="contest-judging-visibility" class="cpub-form-label">Score Visibility</label>
          <select id="contest-judging-visibility" v-model="judgingVisibility" class="cpub-form-input">
            <option value="judges-only">Judges only, scores hidden until results</option>
            <option value="public">Public, show scores during judging</option>
            <option value="private">Private, scores stay with organizers</option>
          </select>
        </div>
        <label class="cpub-form-check">
          <input v-model="communityVotingEnabled" type="checkbox" />
          <span>Enable community voting</span>
        </label>

        <div class="cpub-subhead">
          <h3 class="cpub-form-subtitle">Judging Criteria <span v-if="criteriaTotal" class="cpub-form-hint-inline">{{ criteriaTotal }} pts</span></h3>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addCriterion"><i class="fa-solid fa-plus"></i> Add Criterion</button>
        </div>
        <div v-for="(crit, ci) in criteria" :key="ci" class="cpub-criterion-row">
          <div class="cpub-form-row">
            <div class="cpub-form-field" style="flex: 3">
              <label :for="`crit-label-${ci}`" class="cpub-form-label">Criterion</label>
              <input :id="`crit-label-${ci}`" v-model="crit.label" type="text" class="cpub-form-input" placeholder="e.g. Documentation" />
            </div>
            <div class="cpub-form-field" style="flex: 1">
              <label :for="`crit-weight-${ci}`" class="cpub-form-label">Points</label>
              <input :id="`crit-weight-${ci}`" v-model.number="crit.weight" type="number" min="0" max="100" class="cpub-form-input" placeholder="20" />
            </div>
            <button type="button" class="cpub-prize-remove cpub-criterion-del" aria-label="Remove criterion" @click="removeCriterion(ci)"><i class="fa-solid fa-times"></i></button>
          </div>
          <div class="cpub-form-field">
            <input v-model="crit.description" type="text" class="cpub-form-input" :aria-label="`Criterion ${ci + 1} description`" placeholder="What judges look for (optional)" />
          </div>
        </div>
      </section>

      <!-- Visibility & Access -->
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
          <div class="cpub-type-options" role="group" aria-label="Roles that can view">
            <label v-for="r in ROLE_OPTIONS" :key="r" class="cpub-form-check">
              <input type="checkbox" :checked="visibleToRoles.includes(r)" @change="toggleRole(r)" />
              <span>{{ r }}</span>
            </label>
          </div>
        </div>
        <div v-if="isOwner" class="cpub-subhead">
          <h3 class="cpub-form-subtitle">Collaborators</h3>
        </div>
        <p v-if="isOwner" class="cpub-form-hint">Grant per-contest access scoped to this contest only, with no system-wide access. Reviewers can view it (even while private or in draft) but can't edit or score. Editors can fully edit this contest.</p>
        <ContestStakeholderManager v-if="isOwner" :contest-slug="slug" />
      </section>

      <!-- Judge panel (single source of truth: contest_judges table) -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Judges</h2>
        <p class="cpub-form-hint">Invited judges receive a notification and must accept before they can score.</p>
        <ContestJudgeManager :contest-slug="slug" :is-owner="isOwner" />
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

      <section class="cpub-form-section">
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

      <section v-if="isOwner" class="cpub-form-section cpub-danger-zone">
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

      <!-- Sticky save bar — always reachable without scrolling to the bottom. -->
      <div class="cpub-edit-actionbar">
        <span class="cpub-edit-actionbar-status">
          Status <span class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
          <span v-if="formDirty" class="cpub-edit-dirty"><i class="fa-solid fa-circle"></i> Unsaved changes</span>
        </span>
        <div class="cpub-edit-actionbar-btns">
          <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-edit-cancel">Cancel</NuxtLink>
          <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim() || !!dateError || !formDirty">
            <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving…' : formDirty ? 'Save Changes' : 'Saved' }}
          </button>
        </div>
      </div>
    </form>
  </div>
  <div v-else-if="contestLoading" class="cpub-not-found"><p>Loading contest…</p></div>
  <div v-else class="cpub-not-found"><p>Contest not found</p></div>
</template>

<style scoped>
.cpub-contest-edit { max-width: 1080px; margin: 0 auto; padding: 32px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.cpub-edit-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.cpub-edit-subtitle { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }

.cpub-status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-default) solid; }
.cpub-status-draft { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); border-style: dashed; }
.cpub-status-upcoming { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-paused { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }
.cpub-status-cancelled { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }

.cpub-edit-form { display: flex; flex-direction: column; gap: 16px; }
/* Two-column editor: wide content column + a sticky meta rail (Stage & Status,
   Entry rules, Danger Zone) so lifecycle controls stay reachable while editing. */
.cpub-edit-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.cpub-edit-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.cpub-edit-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 76px; }
.cpub-form-section { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 20px; box-shadow: var(--shadow-md); }
.cpub-form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
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
.cpub-subhead { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 10px; }
.cpub-form-subtitle { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; }
.cpub-form-hint-inline { font-size: 10px; color: var(--accent); }
.cpub-form-hint { font-size: 11px; color: var(--text-faint); margin: 0 0 12px; line-height: 1.5; }

.cpub-prize-row, .cpub-criterion-row { border: var(--border-width-default) solid var(--border); padding: 14px; margin-bottom: 10px; background: var(--surface2); }
.cpub-prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpub-prize-label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.cpub-prize-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; }
.cpub-prize-remove:hover { color: var(--red); }
.cpub-criterion-row .cpub-form-row { align-items: flex-end; }
.cpub-criterion-del { align-self: flex-end; margin-bottom: 12px; }

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

/* Sticky save bar — pinned to the viewport bottom while editing the long form. */
.cpub-edit-actionbar {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 4px -32px -32px;
  padding: 14px 32px;
  background: var(--surface);
  border-top: 2px solid var(--border);
  box-shadow: var(--shadow-lg);
}
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
.cpub-edit-actionbar-status { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cpub-edit-dirty { color: var(--accent); display: inline-flex; align-items: center; gap: 5px; }
.cpub-edit-dirty i { font-size: 6px; }
.cpub-edit-actionbar-btns { display: flex; align-items: center; gap: 8px; }

/* Collapse the meta rail under the main column on narrower viewports. */
@media (max-width: 900px) {
  .cpub-edit-layout { grid-template-columns: 1fr; }
  .cpub-edit-side { position: static; }
}
@media (max-width: 768px) {
  .cpub-contest-edit { padding: 16px; }
  .cpub-form-row { grid-template-columns: 1fr; }
  .cpub-edit-actionbar { margin: 4px -16px -16px; padding: 12px 16px; }
}
</style>
