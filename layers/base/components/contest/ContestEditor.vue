<script setup lang="ts">
/**
 * ContestEditor — the one editor shell behind BOTH the create and edit routes
 * (`mode` prop). create.vue / [slug]/edit.vue are thin `layout: false` shells that
 * mount this, so creating a contest is identical to editing one.
 *
 * Layout matches the house project/blog/explainer editor: a full-screen
 * `cpub-ce-layout` with a topbar (back · title · status · autosave · View · Save)
 * and a 3-panel `cpub-ce-shell` — LEFT block palette · CENTER body tabs
 * (Overview/Rules/Prizes) · RIGHT settings rail (Details/Schedule/Stages/Entries/
 * Prizes/Judging/Access/People/Danger). The editable form model lives in
 * useContestEditor (tested in isolation). Edit-only rails (People, lifecycle
 * transitions, advancement, danger zone) are gated on `mode === 'edit'`.
 */
import type { Ref } from 'vue';
import { EditorBlocks, EditorSection, useBlockEditor, BLOCK_COMPONENTS_KEY, UPLOAD_HANDLER_KEY, type BlockTypeGroup } from '@commonpub/editor/vue';
import type { ContestEditorSource } from '../../composables/useContestEditor';
import JudgesShowcaseBlock from './blocks/JudgesShowcaseBlock.vue';
import HtmlBlock from './blocks/HtmlBlock.vue';
import CriteriaBarBlock from './blocks/CriteriaBarBlock.vue';
import TableBlock from './blocks/TableBlock.vue';
import TabsBlock from './blocks/TabsBlock.vue';
import SponsorsBlock from './blocks/SponsorsBlock.vue';
import CompareColumnsBlock from './blocks/CompareColumnsBlock.vue';
import RoadmapBlock from './blocks/RoadmapBlock.vue';
// Explicit import (matches ContestStageCard): auto-import prefixes this dir's
// components with "Contest", so the bare <FormTemplateEditor> tag resolves to
// nothing (its auto-name is ContestFormTemplateEditor) and the registration
// editor renders as an empty custom element. The explicit import fixes that.
import FormTemplateEditor from './FormTemplateEditor.vue';
import { CONTEST_SCHEDULE_KEY, roadmapFromSchedule } from '../../utils/contestBlocks';
import { standardContestTemplate } from '../../utils/contestTemplates';

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
  bannerUrl, coverImageUrl, bannerMeta, coverMeta, coverPlacement, startDate, endDate, judgingEndDate, communityVotingEnabled,
  judgingVisibility, eligibleContentTypes, maxEntriesPerUser, visibility, visibleToRoles,
  showPrizes, prizes, criteria, stages, currentStageId, registrationTemplate, registrationMode, emailCopy, setEmailCopy,
  saving, formDirty, dateError, canSubmit, slugify, toggleType, toggleRole, addPrize, removePrize, prizeLabel, save,
} = editor;

// Contest builder feature flags (drive the submission-form field types + the
// new-contest template's proposal-vs-attach choice). Reactive; hydrate from
// /api/features after mount.
const { features } = useFeatures();
const proposalsEnabled = computed(() => features.value.contestProposals === true);
const piiEnabled = computed(() => features.value.contestPii === true);
// The per-contest email editor needs a persisted contest (per-contest preview +
// save), so it is edit-only, and gated on its feature flag.
const emailEditorEnabled = computed(() => props.mode === 'edit' && features.value.contestEmailEditor === true);
// The Registration form tab is gated the same way its consumer (the public
// sign-up card) is — the contestSignup flag (default on) — so an operator can't
// build a form that renders nowhere.
const signupEnabled = computed(() => features.value.contestSignup !== false);

// --- Hoisted body block editors (the one refactor: a single left palette inserts
// into the CURRENTLY-active body, so the three useBlockEditor instances live here
// where the palette lives, not inside per-body components). ---
const blockDefaults = { blockDefaults: { judgesShowcase: () => ({ judges: [] }), html: () => ({ html: '' }), criteriaBar: () => ({ items: [], showLegend: true }), table: () => ({ header: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']] }), tabs: () => ({ tabs: [{ label: 'Tab 1', blocks: [] }, { label: 'Tab 2', blocks: [] }] }), sponsors: () => ({ logos: [] }), compareColumns: () => ({ columns: [{ tone: 'positive', title: 'Encouraged', items: [''] }, { tone: 'negative', title: 'Out of scope', items: [''] }] }), roadmap: () => ({ items: [] }) } };
const overviewEditor = useBlockEditor(seedBodyBlocks(descriptionBlocks.value, description.value, descriptionFormat.value), blockDefaults);
const rulesEditor = useBlockEditor(seedBodyBlocks(rulesBlocks.value, rules.value, rulesFormat.value), blockDefaults);
const prizesEditor = useBlockEditor(seedBodyBlocks(prizesBlocks.value, prizesDescription.value, prizesDescriptionFormat.value), blockDefaults);

type BodyTab = 'overview' | 'rules' | 'prizes' | 'stages' | 'registration' | 'emails';
const activeTab = ref<BodyTab>('overview');
const bodyMode = ref<'write' | 'preview' | 'code'>('write');
// Registration builder: the field index linked between the form editor and its
// live preview (focus a card ⇄ click a preview field). -1 = none active.
const activeRegField = ref(-1);
// Clear the link when the field set changes shape (add/remove/reorder) so a
// stale index can't briefly highlight the wrong field; it re-arms on next focus.
watch(() => registrationTemplate.value.length, () => { activeRegField.value = -1; });
// The Stages tab has no block editor; it falls back to overview (the palette is
// hidden there anyway, so nothing inserts into it).
const activeBodyEditor = computed(() => {
  const map: Partial<Record<BodyTab, typeof overviewEditor>> = { overview: overviewEditor, rules: rulesEditor, prizes: prizesEditor };
  return map[activeTab.value] ?? overviewEditor;
});

// Contest-specific edit block + image upload, provided once for all three bodies.
provide(BLOCK_COMPONENTS_KEY, { judgesShowcase: JudgesShowcaseBlock, html: HtmlBlock, criteriaBar: CriteriaBarBlock, table: TableBlock, tabs: TabsBlock, sponsors: SponsorsBlock, compareColumns: CompareColumnsBlock, roadmap: RoadmapBlock });
// Feed the criteria-bar block this contest's live rubric (for its auto-fill).
provide(CONTEST_RUBRIC_KEY, criteria);
// Feed the roadmap block a timeline derived from the contest's effective schedule
// (custom stages, else the core flow) for its "Pull from schedule" seed.
const scheduleRoadmap = computed(() => roadmapFromSchedule(stages.value, { startDate: startDate.value, endDate: endDate.value, judgingEndDate: judgingEndDate.value }));
provide(CONTEST_SCHEDULE_KEY, scheduleRoadmap);
const { uploadFile } = useFileUpload();
provide(UPLOAD_HANDLER_KEY, (file: File) => uploadFile<{ url: string; width?: number | null; height?: number | null }>(file, 'content'));
// Feed the Judges Showcase block a loader for the real scoring panel, so it can
// offer "Import panel judges" (name + account avatar). Empty in create mode (no
// slug yet). Maps the judges API row shape to the showcase's curated-row shape.
provide(CONTEST_JUDGES_KEY, async () => {
  if (!slug.value) return [];
  const rows = await $fetch<Array<{ userName: string; userAvatar?: string | null; userUsername: string; role: string }>>(
    `/api/contests/${slug.value}/judges`,
  );
  return rows.map((r) => ({
    name: r.userName,
    avatarUrl: r.userAvatar ?? undefined,
    link: r.userUsername ? `/u/${r.userUsername}` : undefined,
  }));
});

// Editor -> model write-back: each body's blocks flow into the composable's
// descriptionBlocks/rulesBlocks/prizesBlocks refs (read by buildPayload).
// `syncingBodies` suppresses the write-back while reseeding from a load so hydration
// doesn't mark the form dirty (legacy contests keep their markdown until the
// organizer actually edits). We mark dirty explicitly here rather than leaning on
// the composable's deep watch, which doesn't reliably observe a whole-array
// reassignment from a structural block insert (an empty/content-less block — image,
// divider, judges-showcase — would otherwise leave Save disabled).
let syncingBodies = false;
function reseedBodies(): void {
  syncingBodies = true;
  overviewEditor.fromBlockTuples(seedBodyBlocks(descriptionBlocks.value, description.value, descriptionFormat.value));
  rulesEditor.fromBlockTuples(seedBodyBlocks(rulesBlocks.value, rules.value, rulesFormat.value));
  prizesEditor.fromBlockTuples(seedBodyBlocks(prizesBlocks.value, prizesDescription.value, prizesDescriptionFormat.value));
  void nextTick(() => { syncingBodies = false; });
}
function syncBody(target: Ref<unknown[] | null>, ed: typeof overviewEditor): void {
  if (syncingBodies) return;
  target.value = ed.toBlockTuples();
  formDirty.value = true;
}
// Watch a GETTER of `.value` (not the readonly ref directly) — the proven pattern
// (pages/.../edit.vue): the getter form fires on structural inserts/removals, the
// bare-readonly-ref form only caught nested content edits.
watch(() => overviewEditor.blocks.value, () => syncBody(descriptionBlocks, overviewEditor), { deep: true });
watch(() => rulesEditor.blocks.value, () => syncBody(rulesBlocks, rulesEditor), { deep: true });
watch(() => prizesEditor.blocks.value, () => syncBody(prizesBlocks, prizesEditor), { deep: true });

const contestBlockGroups: BlockTypeGroup[] = [
  {
    name: 'Basic',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section header' },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed' },
      { type: 'code_block', label: 'Code', icon: 'fa-code', description: 'Syntax-highlighted code' },
    ],
  },
  {
    name: 'Contest',
    blocks: [
      { type: 'judgesShowcase', label: 'Judges Showcase', icon: 'fa-user-group', description: 'Avatar + bio cards for the overview' },
      { type: 'criteriaBar', label: 'Criteria Bar', icon: 'fa-chart-simple', description: 'Weighted judging criteria as one stacked bar' },
      { type: 'sponsors', label: 'Sponsors', icon: 'fa-handshake-angle', description: 'Logo wall with optional tiers + links' },
      { type: 'compareColumns', label: 'In / Out of Scope', icon: 'fa-table-columns', description: 'Side-by-side columns, e.g. Encouraged vs Out of scope' },
      { type: 'roadmap', label: 'Roadmap', icon: 'fa-timeline', description: 'Schedule timeline, seedable from the contest stages' },
    ],
  },
  {
    name: 'Media',
    blocks: [
      { type: 'video', label: 'Video', icon: 'fa-film', description: 'YouTube, Vimeo embed' },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External embed (translates YouTube/Vimeo URLs)' },
    ],
  },
  {
    name: 'Rich',
    blocks: [
      { type: 'callout', label: 'Tip', icon: 'fa-lightbulb', description: 'Tip callout', attrs: { variant: 'tip' } },
      { type: 'callout', label: 'Warning', icon: 'fa-triangle-exclamation', description: 'Warning callout', attrs: { variant: 'warning' } },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
      { type: 'html', label: 'HTML', icon: 'fa-code', description: 'Raw HTML snippet (sanitized on render)' },
      { type: 'table', label: 'Table', icon: 'fa-table', description: 'Responsive data table' },
    ],
  },
  {
    name: 'Layout',
    blocks: [
      { type: 'tabs', label: 'Tabs', icon: 'fa-folder-tree', description: 'Tabbed panels, e.g. multiple rule sets (Track A / Track B)' },
    ],
  },
];

// Registration-link CTA block — gated by the `registrationBlock` flag (default ON).
// Droppable into every contest body editor (overview / rules / prizes) since they
// all share this palette. A core block, so it edits + renders with no extra wiring.
if (features.value.registrationBlock) {
  (contestBlockGroups.find((g) => g.name === 'Basic') ?? contestBlockGroups[0])?.blocks.push({
    type: 'registrationLink', label: 'Registration Link', icon: 'fa-user-plus', description: 'Sign-up call-to-action button',
  });
}

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

// --- Inline media (banner + cover) shown at the top of the Overview body ---
function uploadMedia(event: Event, target: Ref<string>, purpose: string): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadFile<{ url: string }>(file, purpose)
    .then((res) => { target.value = res.url; })
    .catch((err: unknown) => { toast.error(extractError(err) || 'Image upload failed'); });
  input.value = '';
}
function onBannerUpload(e: Event): void { uploadMedia(e, bannerUrl, 'banner'); }
function onCoverUpload(e: Event): void { uploadMedia(e, coverImageUrl, 'cover'); }
function onBannerUrl(): void { const url = window.prompt('Enter banner image URL:'); if (url) bannerUrl.value = url; }
// Non-destructive framing (P4): toggle the zoom/reposition panels per image; the
// inline previews mirror the public hero via the shared imageFramingStyle util.
const showBannerAdjust = ref(false);
const showCoverAdjust = ref(false);
const bannerPreviewStyle = computed(() => imageFramingStyle(bannerMeta.value));
const coverPreviewStyle = computed(() => imageFramingStyle(coverMeta.value));
const bannerPreviewWhole = computed(() => isWholeImage(bannerMeta.value));
const coverPreviewWhole = computed(() => isWholeImage(coverMeta.value));

// --- Right-rail collapsible sections ---
const openSections = ref<Record<string, boolean>>({
  details: true, schedule: true, stages: false, entries: true,
  prizes: false, judging: false, access: false, people: false, danger: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const deleting = ref(false);

// Hydrate the form model when the contest loads (edit).
watch(contest, (c) => {
  if (!c) return;
  // Never clobber unsaved edits with a refetch (e.g. an autosave rename swaps the
  // URL and re-fetches the renamed contest while the organizer keeps typing).
  if (formDirty.value) return;
  editor.hydrate(c as ContestEditorSource);
  reseedBodies();
}, { immediate: true });

// Create mode: seed the standard starter template (a Proposals stage with a form +
// rules agreement, a Judging stage, a Results stage, a default rubric, and starter
// Overview/Rules copy) so a new contest doesn't start blank. Flag-adaptive: proposal
// mode + the agreement field only seed where those builder features are on; else it
// degrades to an attach-mode entry stage. Runs once on mount (client-only editor, so
// the feature flags are already SSR-primed). reseedBodies() pushes the seeded body
// blocks into the hoisted block editors.
onMounted(() => {
  if (props.mode !== 'create') return;
  editor.applyTemplate(standardContestTemplate({ proposals: proposalsEnabled.value, pii: piiEnabled.value }));
  reseedBodies();
});

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

// --- Topbar Status menu (the contest analogue of Publish; lifecycle lives here,
// not the rail). Edit-only. Closes on select, Escape, or an outside pointer. ---
const statusMenuOpen = ref(false);
const statusMenuRef = ref<HTMLElement | null>(null);
const statusToggleRef = ref<HTMLButtonElement | null>(null);
function statusItems(): HTMLElement[] {
  return Array.from(statusMenuRef.value?.querySelectorAll<HTMLElement>('.cpub-ce-status-item') ?? []);
}
function closeStatusMenu(focusToggle = false): void {
  statusMenuOpen.value = false;
  if (focusToggle) void nextTick(() => statusToggleRef.value?.focus());
}
// Menu-button keyboard pattern: opening focuses the first action; arrows rove;
// Escape closes and returns focus to the toggle.
function toggleStatusMenu(): void {
  statusMenuOpen.value = !statusMenuOpen.value;
  if (statusMenuOpen.value) void nextTick(() => statusItems()[0]?.focus());
}
function onStatusItemKey(e: KeyboardEvent): void {
  const items = statusItems();
  if (!items.length) return;
  const cur = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(cur + 1) % items.length]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(cur - 1 + items.length) % items.length]?.focus(); }
  else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
  else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
}
async function selectTransition(t: string): Promise<void> { closeStatusMenu(); await transitionStatus(t); }
function onStatusDocPointer(e: PointerEvent): void {
  if (statusMenuOpen.value && statusMenuRef.value && !statusMenuRef.value.contains(e.target as Node)) closeStatusMenu();
}
function onStatusDocKey(e: KeyboardEvent): void { if (e.key === 'Escape' && statusMenuOpen.value) closeStatusMenu(true); }
onMounted(() => {
  document.addEventListener('pointerdown', onStatusDocPointer);
  document.addEventListener('keydown', onStatusDocKey);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', onStatusDocPointer);
  document.removeEventListener('keydown', onStatusDocKey);
});

// Advancement (ContestAdvancementPanel, in the Stages tab) operates on the
// PERSISTED review stages (contest.value), not the editable `stages` ref, since it
// acts on real entries.
const reviewStages = computed(() => (contest.value?.stages ?? []).filter((s) => s.kind === 'review'));
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
  <!-- Not a <form>: the 3-panel shell embeds many third-party buttons (palette,
       section headers, canvas controls) that default to type="submit"; a form would
       let any of them trigger a save. We drive Save explicitly via @click. -->
  <div v-else-if="mode === 'create' || contest" class="cpub-ce-layout">
    <!-- Topbar: back · title · status · autosave · View · Save -->
    <header class="cpub-ce-topbar">
      <NuxtLink :to="mode === 'edit' ? `/contests/${slug}` : '/contests'" class="cpub-ce-back" aria-label="Back">
        <i class="fa-solid fa-arrow-left"></i>
      </NuxtLink>
      <div class="cpub-ce-topbar-divider" aria-hidden="true" />
      <div class="cpub-ce-title-wrap">
        <input
          v-model="title"
          type="text"
          class="cpub-ce-title-input"
          :placeholder="mode === 'create' ? 'Contest title...' : 'Contest title'"
          aria-label="Contest title"
        />
        <span v-if="mode === 'edit' && contest" class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
        <span v-if="mode === 'create'" class="cpub-ce-required">Required: title, start &amp; end dates</span>
        <span
          v-else-if="isDraftAutosave"
          class="cpub-ce-autosave"
          :class="{ 'cpub-ce-autosave-err': autosaveError }"
          role="status"
          aria-live="polite"
        ><i class="fa-solid" :class="autosaveIcon"></i> {{ autosaveLabel }}</span>
        <span v-else-if="formDirty" class="cpub-ce-dirty"><i class="fa-solid fa-circle"></i> Unsaved</span>
      </div>
      <div class="cpub-ce-topbar-spacer" />
      <div class="cpub-ce-topbar-actions">
        <NuxtLink v-if="mode === 'edit'" :to="`/contests/${slug}`" class="cpub-ce-topbar-btn">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> View
        </NuxtLink>
        <button type="button" class="cpub-ce-topbar-btn cpub-ce-topbar-btn-primary" :disabled="busy || !canSubmit" @click="onSave">
          <i class="fa-solid" :class="mode === 'create' ? 'fa-trophy' : 'fa-floppy-disk'"></i>
          {{ busy ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create Contest' : (formDirty ? 'Save Changes' : 'Saved')) }}
        </button>

        <!-- Lifecycle transitions (edit-only) live in this Status menu, not the rail. -->
        <div v-if="mode === 'edit' && contest" ref="statusMenuRef" class="cpub-ce-status-menu">
          <button
            ref="statusToggleRef"
            type="button"
            class="cpub-ce-topbar-btn"
            id="cpub-ce-status-toggle"
            aria-haspopup="menu"
            aria-controls="cpub-ce-status-dropdown"
            :aria-expanded="statusMenuOpen"
            @click="toggleStatusMenu"
          >
            <i class="fa-solid fa-flag"></i> Status <i class="fa-solid fa-chevron-down cpub-ce-status-caret" :class="{ open: statusMenuOpen }"></i>
          </button>
          <div v-if="statusMenuOpen" id="cpub-ce-status-dropdown" class="cpub-ce-status-dropdown" role="menu" aria-label="Change contest status" @keydown="onStatusItemKey">
            <p class="cpub-ce-status-current">
              Current: <span class="cpub-status-badge" :class="`cpub-status-${contest.status}`">{{ contest.status }}</span>
            </p>
            <button
              v-for="t in availableTransitions"
              :key="t"
              type="button"
              role="menuitem"
              tabindex="-1"
              class="cpub-ce-status-item"
              :class="{
                'cpub-ce-status-go': statusAction(t).tone === 'go',
                'cpub-ce-status-warn': statusAction(t).tone === 'warn',
                'cpub-ce-status-danger': statusAction(t).tone === 'danger',
              }"
              @click="selectTransition(t)"
            >
              <i class="fa-solid" :class="statusAction(t).icon"></i> {{ statusAction(t).label }}
            </button>
            <p v-if="!availableTransitions.length" class="cpub-ce-status-empty">
              <i class="fa-solid fa-circle-check"></i> No status changes available from <strong>{{ contest.status }}</strong>.
            </p>
          </div>
        </div>
      </div>
    </header>

    <div class="cpub-ce-shell">
      <!-- LEFT: block palette — inserts into the currently-active body. Hidden on
           the Stages + Emails tabs (forms, not block bodies), giving them more room. -->
      <aside v-show="activeTab !== 'stages' && activeTab !== 'emails' && activeTab !== 'registration'" class="cpub-ce-library" aria-label="Block palette">
        <EditorBlocks :groups="contestBlockGroups" :block-editor="activeBodyEditor" />
      </aside>

      <!-- CENTER: contest body (Overview / Rules / Prizes). -->
      <div class="cpub-ce-center">
        <ContestBodyCanvas
          :editor="activeBodyEditor"
          :groups="contestBlockGroups"
          :active-tab="activeTab"
          :mode="bodyMode"
          :show-registration="signupEnabled"
          :show-emails="emailEditorEnabled"
          @update:active-tab="activeTab = $event"
          @update:mode="bodyMode = $event"
        >
          <!-- Banner + cover render inline at the top of the Overview body only. -->
          <template #overview-lead>
            <div class="cpub-ce-media">
              <div class="cpub-ce-banner" :class="{ 'has-image': !!bannerUrl, 'cpub-ce-banner--whole': bannerPreviewWhole }">
                <img v-if="bannerUrl" :src="bannerUrl" alt="Contest banner" class="cpub-ce-banner-img" :style="bannerPreviewWhole ? undefined : bannerPreviewStyle" />
                <div v-else class="cpub-ce-media-placeholder">
                  <i class="fa-regular fa-image"></i>
                  <span>Banner image</span>
                </div>
                <div class="cpub-ce-media-overlay">
                  <label class="cpub-ce-media-btn primary">
                    <i class="fa-solid fa-arrow-up-from-bracket"></i> {{ bannerUrl ? 'Replace' : 'Upload' }}
                    <input type="file" accept="image/*" class="cpub-sr-only" aria-label="Upload banner image" @change="onBannerUpload">
                  </label>
                  <button type="button" class="cpub-ce-media-btn" @click="onBannerUrl"><i class="fa-solid fa-link"></i> URL</button>
                  <button v-if="bannerUrl" type="button" class="cpub-ce-media-btn" :class="{ active: showBannerAdjust }" @click="showBannerAdjust = !showBannerAdjust"><i class="fa-solid fa-crop-simple"></i> Adjust</button>
                  <button v-if="bannerUrl" type="button" class="cpub-ce-media-btn" @click="bannerUrl = ''"><i class="fa-solid fa-trash"></i> Remove</button>
                </div>

                <!-- Cover thumbnail, inset over the banner's lower-left (mirrors the public hero). -->
                <div class="cpub-ce-cover" :class="{ 'has-image': !!coverImageUrl, 'cpub-ce-cover--whole': coverPreviewWhole }">
                  <img v-if="coverImageUrl" :src="coverImageUrl" alt="Contest cover" class="cpub-ce-cover-img" :style="coverPreviewWhole ? undefined : coverPreviewStyle" />
                  <div v-else class="cpub-ce-media-placeholder cpub-ce-media-placeholder-sm">
                    <i class="fa-regular fa-image"></i>
                    <span>Cover</span>
                  </div>
                  <div class="cpub-ce-media-overlay">
                    <label class="cpub-ce-media-btn primary cpub-ce-media-btn-icon" title="Upload cover image">
                      <i class="fa-solid fa-arrow-up-from-bracket"></i>
                      <input type="file" accept="image/*" class="cpub-sr-only" aria-label="Upload cover image" @change="onCoverUpload">
                    </label>
                    <button v-if="coverImageUrl" type="button" class="cpub-ce-media-btn cpub-ce-media-btn-icon" :class="{ active: showCoverAdjust }" title="Adjust cover framing" @click="showCoverAdjust = !showCoverAdjust"><i class="fa-solid fa-crop-simple"></i></button>
                    <button v-if="coverImageUrl" type="button" class="cpub-ce-media-btn cpub-ce-media-btn-icon" title="Remove cover" @click="coverImageUrl = ''"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </div>
              </div>

              <!-- Non-destructive framing panels (P4) -->
              <ContestBannerAdjust v-if="bannerUrl && showBannerAdjust" v-model="bannerMeta" :image-url="bannerUrl" aspect="4 / 1" label="Banner" class="cpub-ce-adjust" />
              <ContestBannerAdjust v-if="coverImageUrl && showCoverAdjust" v-model="coverMeta" :image-url="coverImageUrl" aspect="4 / 3" label="Cover" class="cpub-ce-adjust" />

              <!-- Where the cover image shows on the public page. -->
              <label v-if="coverImageUrl" class="cpub-ce-cover-place">
                <span class="cpub-form-label" style="margin: 0;">Show cover</span>
                <select :value="coverPlacement ?? 'about'" class="cpub-form-input" @change="coverPlacement = (($event.target as HTMLSelectElement).value as 'about' | 'hero')">
                  <option value="about">In the Overview "About" section</option>
                  <option value="hero">In the hero, under the subheading</option>
                </select>
              </label>

              <p class="cpub-form-hint cpub-ce-media-hint">Banner is the wide hero (~4:1). Cover is the card thumbnail in listings (~4:3); it falls back to the banner if unset. Use Adjust to set Fill, Fit (whole image), or Zoom without re-cropping.</p>
            </div>
          </template>

          <!-- Stages tab: the public timeline + per-stage submission forms, plus the
               edit-only Top-N/manual advancement (which acts on real entries). -->
          <template #stages>
            <div class="cpub-ce-stages-tab">
              <p class="cpub-form-hint">Stages are the public timeline (Submissions → Judging → Results, or your own rounds). Each <strong>Submissions</strong> stage carries a submission form; each <strong>Judging</strong> stage its own rubric + Top-N cut. The <strong>Status</strong> control (top bar) is what's actually open now; mark a stage <strong>Current</strong> to point judges + the countdown at it.</p>
              <ContestStagesEditor
                v-model="stages"
                v-model:current-stage-id="currentStageId"
                :start-date="startDate"
                :end-date="endDate"
                :judging-end-date="judgingEndDate"
              />
              <ContestAdvancementPanel
                v-if="mode === 'edit' && reviewStages.length"
                :slug="slug"
                :review-stages="reviewStages"
                @advanced="refresh()"
              />
            </div>
          </template>

          <!-- Registration tab: the operator's registration form builder + a live preview. -->
          <template #registration>
            <div class="cpub-ce-reg-tab">
              <p class="cpub-form-hint">Build the form participants fill when they register. Answers are stored the same way entries are — public answers on the registration, personal data (email/address/PII fields) stored privately, and consent (agreements) recorded to the audit log. Leave it empty to use the default sign-up questions.</p>
              <fieldset class="cpub-ce-reg-mode">
                <legend class="cpub-form-label" style="margin: 0 0 6px;">Registration mode</legend>
                <label class="cpub-ce-reg-mode-opt">
                  <input type="radio" value="light" :checked="registrationMode === 'light'" @change="registrationMode = 'light'" />
                  <span><strong>Light</strong> — registering records participation; entering a project is a separate step.</span>
                </label>
                <label class="cpub-ce-reg-mode-opt">
                  <input type="radio" value="combined" :checked="registrationMode === 'combined'" @change="registrationMode = 'combined'" />
                  <span><strong>Combined</strong> — registering also creates the participant's entry (a draft they develop). One-step intake. Requires a proposal-mode submission stage.</span>
                </label>
              </fieldset>
              <div class="cpub-ce-reg-builder">
                <div class="cpub-ce-reg-editor">
                  <FormTemplateEditor
                    v-model:template="registrationTemplate"
                    :active-index="activeRegField"
                    label="Registration form"
                    hint="Add the fields you want to collect at sign-up. Group them with section headers; mark personal-data fields as PII."
                    @field-activate="activeRegField = $event"
                  />
                </div>
                <div class="cpub-ce-reg-preview">
                  <div class="cpub-ce-reg-preview-inner">
                    <div class="cpub-ce-reg-preview-head">
                      <span class="cpub-form-label" style="margin: 0;">Preview</span>
                      <span class="cpub-ce-reg-preview-tag">What participants see</span>
                    </div>
                    <p v-if="registrationTemplate.length" class="cpub-form-hint cpub-ce-reg-preview-hint">Click a field to jump to it in the builder.</p>
                    <ContestRegistrationForm
                      :template="effectiveRegistrationTemplate(registrationTemplate)"
                      :active-index="activeRegField"
                      preview
                      @field-activate="activeRegField = $event"
                    />
                  </div>
                </div>
              </div>
              <ContestRegistrantsPanel v-if="mode === 'edit'" :slug="slug" />
            </div>
          </template>

          <!-- Emails tab: per-contest email copy editor with a live preview. -->
          <template v-if="emailEditorEnabled" #emails>
            <ContestEmailEditor :slug="slug" v-model="emailCopy" @load="setEmailCopy" />
          </template>
        </ContestBodyCanvas>
        <p v-if="activeTab !== 'stages' && activeTab !== 'emails' && activeTab !== 'registration'" class="cpub-form-hint cpub-ce-body-hint">
          The <strong>Overview</strong>, <strong>Rules</strong>, and <strong>Prizes</strong> bodies are blocks
          (headings, lists, images, callouts, and the <strong>Judges Showcase</strong>), like the project and blog
          editors. Add blocks from the palette on the left. The <strong>Stages</strong> tab holds the timeline +
          submission forms; judging, prizes, and access live in the settings rail. Legacy text converts to blocks on first edit.
        </p>
      </div>

      <!-- RIGHT: settings rail. -->
      <aside class="cpub-ce-settings" aria-label="Contest settings">
        <div class="cpub-ce-settings-body">
          <EditorSection title="Details" icon="fa-circle-info" :open="openSections.details" @toggle="toggleSection('details')">
            <div class="cpub-form-field">
              <label for="contest-slug" class="cpub-form-label">URL Slug</label>
              <input id="contest-slug" v-model="slugInput" type="text" class="cpub-form-input" :placeholder="mode === 'create' ? 'auto-generated from title' : ''" @input="slugTouched = true" @blur="slugInput = slugify(slugInput)" />
              <p class="cpub-form-hint"><code>/contests/{{ slugify(slugInput) || 'your-contest' }}</code>. {{ mode === 'create' ? 'Auto-fills from the title.' : 'Changing it breaks old links, they won\'t redirect.' }}</p>
            </div>
            <div class="cpub-form-field">
              <label for="contest-subheading" class="cpub-form-label">Subheading</label>
              <input id="contest-subheading" v-model="subheading" type="text" maxlength="300" class="cpub-form-input" placeholder="One-line tagline shown in the contest header" />
              <p class="cpub-form-hint">Short plain-text tagline shown under the title in the hero.</p>
            </div>
          </EditorSection>

          <EditorSection title="Schedule" icon="fa-calendar" :open="openSections.schedule" @toggle="toggleSection('schedule')">
            <div class="cpub-form-field">
              <CpubDateTimeField label="Start Date" :model-value="startDate" :required="mode === 'create'" @update:model-value="startDate = $event ?? ''" />
            </div>
            <div class="cpub-form-field">
              <CpubDateTimeField label="End Date" :model-value="endDate" :min="startDate || undefined" :required="mode === 'create'" @update:model-value="endDate = $event ?? ''" />
            </div>
            <div class="cpub-form-field">
              <CpubDateTimeField label="Judging End Date" :model-value="judgingEndDate" :min="endDate || undefined" @update:model-value="judgingEndDate = $event ?? ''" />
            </div>
            <p v-if="dateError" class="cpub-form-error" role="alert">{{ dateError }}</p>
          </EditorSection>

          <EditorSection title="Entries" icon="fa-inbox" :open="openSections.entries" @toggle="toggleSection('entries')">
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
          </EditorSection>

          <EditorSection title="Prizes" icon="fa-trophy" :open="openSections.prizes" @toggle="toggleSection('prizes')">
            <label class="cpub-form-check" style="margin-bottom: 10px;">
              <input v-model="showPrizes" type="checkbox" />
              <span>Show the Prizes tab on the contest page</span>
            </label>
            <p v-if="!showPrizes" class="cpub-form-hint">The Prizes tab is hidden, any prizes below are saved but not shown to visitors.</p>
            <p class="cpub-form-hint">Every field is optional. Use <strong>place</strong> for ranked prizes, a <strong>category</strong> for themed awards, or just a <strong>description</strong>. The prizes <em>overview</em> copy is edited in the body's Prizes tab.</p>
            <div v-for="(prize, i) in prizes" :key="i" class="cpub-prize-row">
              <div class="cpub-prize-header">
                <span class="cpub-prize-label">{{ prizeLabel(prize) }}</span>
                <button type="button" class="cpub-prize-remove" aria-label="Remove prize" @click="removePrize(i)"><i class="fa-solid fa-times"></i></button>
              </div>
              <div class="cpub-form-field">
                <label :for="`prize-place-${i}`" class="cpub-form-label">Place</label>
                <input :id="`prize-place-${i}`" v-model.number="prize.place" type="number" min="1" class="cpub-form-input" placeholder="1" />
              </div>
              <div class="cpub-form-field">
                <label :for="`prize-category-${i}`" class="cpub-form-label">Category (optional)</label>
                <input :id="`prize-category-${i}`" v-model="prize.category" type="text" class="cpub-form-input" placeholder="e.g. Best in Show" />
              </div>
              <div class="cpub-form-field">
                <label :for="`prize-title-${i}`" class="cpub-form-label">Title</label>
                <input :id="`prize-title-${i}`" v-model="prize.title" type="text" class="cpub-form-input" placeholder="e.g. Gold Prize" />
              </div>
              <div class="cpub-form-field">
                <label :for="`prize-value-${i}`" class="cpub-form-label">Value</label>
                <input :id="`prize-value-${i}`" v-model="prize.value" type="text" class="cpub-form-input" placeholder="e.g. $500" />
              </div>
              <div class="cpub-form-field">
                <label :for="`prize-desc-${i}`" class="cpub-form-label">Description</label>
                <input :id="`prize-desc-${i}`" v-model="prize.description" type="text" class="cpub-form-input" placeholder="Optional description" />
              </div>
            </div>
            <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize"><i class="fa-solid fa-plus"></i> Add Prize</button>
          </EditorSection>

          <EditorSection title="Judging" icon="fa-scale-balanced" :open="openSections.judging" @toggle="toggleSection('judging')">
            <div class="cpub-form-field">
              <label for="contest-judging-visibility" class="cpub-form-label">Score visibility</label>
              <select id="contest-judging-visibility" v-model="judgingVisibility" class="cpub-form-input">
                <option value="judges-only">Judges only, scores hidden until results</option>
                <option value="public">Public, show scores during judging</option>
                <option value="private">Private, scores stay with organizers</option>
              </select>
            </div>
            <label class="cpub-form-check"><input v-model="communityVotingEnabled" type="checkbox" /> <span>Enable community voting (advisory audience favourite, doesn't affect ranks)</span></label>
            <p class="cpub-form-hint" style="margin-top: 12px;">The rubric below is the contest's default criteria. A review stage can override it with per-round criteria. Leave it empty and judges score an overall 1 to 100.</p>
            <ContestCriteriaEditor v-model="criteria" label="Judging criteria" :show-total="true" />
          </EditorSection>

          <EditorSection title="Access" icon="fa-eye" :open="openSections.access" @toggle="toggleSection('access')">
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
          </EditorSection>

          <EditorSection v-if="mode === 'edit'" title="People" icon="fa-user-group" :open="openSections.people" @toggle="toggleSection('people')">
            <ContestJudgeManager :contest-slug="slug" :is-owner="isOwner" />
            <div v-if="isOwner" class="cpub-people-collab">
              <h3 class="cpub-form-subtitle">Collaborators</h3>
              <p class="cpub-form-hint">Per-contest access only (no system-wide). Reviewers can view, even while private or draft; editors can edit.</p>
              <ContestStakeholderManager :contest-slug="slug" />
            </div>
          </EditorSection>
          <EditorSection v-else title="People" icon="fa-user-group" :open="openSections.people" @toggle="toggleSection('people')">
            <p class="cpub-form-hint" style="margin: 0;">Add judges, reviewers, and collaborators from the contest's Edit page once it's created.</p>
          </EditorSection>

          <EditorSection v-if="mode === 'edit' && isOwner" title="Danger Zone" icon="fa-triangle-exclamation" :open="openSections.danger" @toggle="toggleSection('danger')">
            <p class="cpub-danger-label">Delete this contest</p>
            <p class="cpub-form-hint">Permanently removes the contest and all of its entries, judges, and reviewers. This cannot be undone.</p>
            <button type="button" class="cpub-btn cpub-btn-danger cpub-danger-btn" :disabled="deleting" @click="handleDelete">
              <i class="fa-solid fa-trash"></i> {{ deleting ? 'Deleting...' : 'Delete Contest' }}
            </button>
          </EditorSection>
        </div>
      </aside>
    </div>
  </div>
  <div v-else-if="contestLoading" class="cpub-not-found"><p>Loading contest…</p></div>
  <div v-else class="cpub-not-found"><p>Contest not found</p></div>
    <template #fallback>
      <div class="cpub-not-found"><p>Loading editor…</p></div>
    </template>
  </ClientOnly>
</template>

<style scoped>
/* --- Full-screen editor layout (matches the house project/blog editor) --- */
.cpub-ce-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}

/* Topbar */
.cpub-ce-topbar {
  height: 48px;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 100;
}
.cpub-ce-back {
  width: 30px; height: 30px;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  text-decoration: none;
}
.cpub-ce-back:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.cpub-ce-topbar-divider { width: 2px; height: 22px; background: var(--border); margin: 0 12px; flex-shrink: 0; }
.cpub-ce-title-wrap { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.cpub-ce-title-input {
  font-size: 13px; font-weight: 500; color: var(--text);
  background: none; border: var(--border-width-default) solid transparent;
  padding: 4px 8px; cursor: text;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 380px; outline: none; font-family: var(--font-sans, system-ui);
}
.cpub-ce-title-input:hover { border-color: var(--border2); background: var(--surface2); }
.cpub-ce-title-input:focus { border-color: var(--accent); background: var(--surface2); }
.cpub-ce-required { font-size: 11px; color: var(--text-faint); white-space: nowrap; }
.cpub-ce-dirty { color: var(--accent); display: inline-flex; align-items: center; gap: 5px; font-size: 11px; }
.cpub-ce-dirty i { font-size: 6px; }
.cpub-ce-autosave { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-faint); white-space: nowrap; }
.cpub-ce-autosave i { font-size: 9px; }
.cpub-ce-autosave-err { color: var(--red-text); }
.cpub-ce-topbar-spacer { flex: 1; }
.cpub-ce-topbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cpub-ce-topbar-btn {
  font-family: var(--font-sans, system-ui); font-size: 12px;
  padding: 6px 14px; border: var(--border-width-default) solid var(--border);
  background: var(--surface); color: var(--text); cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
}
.cpub-ce-topbar-btn:hover { background: var(--surface2); }
.cpub-ce-topbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-ce-topbar-btn-primary { background: var(--accent); color: var(--color-text-inverse); font-weight: 600; border-color: var(--accent); box-shadow: var(--shadow-md); }
.cpub-ce-topbar-btn-primary:hover:not(:disabled) { box-shadow: var(--shadow-sm); background: var(--accent); }

/* Topbar Status ▾ dropdown */
.cpub-ce-status-menu { position: relative; }
.cpub-ce-status-caret { font-size: 9px; transition: transform 0.15s; }
.cpub-ce-status-caret.open { transform: rotate(180deg); }
.cpub-ce-status-dropdown {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 200; min-width: 220px;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md); padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.cpub-ce-status-current { font-size: 11px; color: var(--text-faint); margin: 0; padding: 4px 8px 6px; display: flex; align-items: center; gap: 6px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-ce-status-item {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 8px 10px; background: none; border: var(--border-width-default) solid transparent;
  color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: var(--font-sans);
}
.cpub-ce-status-item:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.cpub-ce-status-item i { width: 14px; text-align: center; font-size: 11px; }
.cpub-ce-status-go { color: var(--green-text); }
.cpub-ce-status-warn { color: var(--yellow-text); }
.cpub-ce-status-danger { color: var(--red-text); }
.cpub-ce-status-empty { font-size: 11px; color: var(--text-dim); margin: 0; padding: 8px 10px; display: flex; align-items: center; gap: 6px; }
.cpub-ce-status-empty i { color: var(--green-text); }

/* 3-panel shell */
.cpub-ce-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-ce-library { width: 220px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }

.cpub-ce-center { flex: 1; overflow-y: auto; background: var(--bg); padding: 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.cpub-ce-body-hint { margin: 0; }

.cpub-ce-settings { width: 340px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ce-settings-body { flex: 1; overflow-y: auto; }

/* --- Status badge (also used in the topbar) --- */
.cpub-status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-default) solid; flex-shrink: 0; }
.cpub-status-draft { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); border-style: dashed; }
.cpub-status-upcoming { color: var(--yellow-text); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green-text); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-paused { color: var(--yellow-text); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }
.cpub-status-cancelled { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }

/* --- Form fields inside the rail (carried over verbatim) --- */
.cpub-form-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
.cpub-form-input {
  width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border);
  background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans);
}
.cpub-form-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-error { font-size: 12px; color: var(--red-text); margin-top: 8px; }
.cpub-form-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
.cpub-form-check input { width: 14px; height: 14px; flex-shrink: 0; }
.cpub-type-options { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
.cpub-form-subtitle { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
.cpub-form-hint { font-size: 11px; color: var(--text-faint); margin: 0 0 12px; line-height: 1.5; }
.cpub-people-collab { margin-top: 16px; padding-top: 12px; border-top: var(--border-width-default) solid var(--border2); }

.cpub-prize-row { border: var(--border-width-default) solid var(--border); padding: 12px; margin-bottom: 10px; background: var(--surface2); }
.cpub-prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpub-prize-label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.cpub-prize-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; }
.cpub-prize-remove:hover { color: var(--red-text); }

/* Stages tab (center) — the form tab gets a little breathing room. */
.cpub-ce-stages-tab { display: flex; flex-direction: column; gap: 4px; }
/* container-type: inline-size makes the tab a query container so the builder
   splits on the REAL available width (center minus the 340px settings rail),
   not a naive viewport breakpoint that collapsed the panes on laptops. */
.cpub-ce-reg-tab { display: flex; flex-direction: column; gap: var(--space-3); container-type: inline-size; }
.cpub-ce-reg-mode { border: var(--border-width-default) solid var(--border2); padding: var(--space-3); margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cpub-ce-reg-mode-opt { display: flex; align-items: flex-start; gap: 8px; font-size: var(--text-sm); color: var(--text-dim); cursor: pointer; }
.cpub-ce-reg-mode-opt input { margin-top: 3px; flex-shrink: 0; }

/* Two-pane builder: editor (left, grows/scrolls with the page) + live preview
   (right, sticky). Stacks editor-first on narrow widths so the editor is never
   pushed off-screen above the preview (the old single-column-collapse bug).
   NOTE: no `align-items: start` — the preview column must STRETCH to the grid
   row height (= the taller editor's height) so its sticky inner has room to
   travel; content-height columns give sticky zero travel and it never pins. */
.cpub-ce-reg-builder { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
.cpub-ce-reg-editor { min-width: 0; }
.cpub-ce-reg-preview { min-width: 0; }
.cpub-ce-reg-preview-inner { border: var(--border-width-default) solid var(--border); background: var(--surface2); padding: var(--space-3); }
.cpub-ce-reg-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.cpub-ce-reg-preview-tag { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); }
.cpub-ce-reg-preview-hint { margin: 0 0 var(--space-2); }
@container (min-width: 760px) {
  .cpub-ce-reg-builder { grid-template-columns: minmax(0, 1fr) minmax(300px, 400px); }
  /* Preview tracks the editor as it scrolls. Small top offset so it clears the
     top of the scrolling center rather than jamming against the very edge. */
  .cpub-ce-reg-preview-inner { position: sticky; top: var(--space-3); }
}

/* Danger zone */
.cpub-danger-label { font-size: 13px; font-weight: 600; margin: 0 0 2px; color: var(--red-text); }
.cpub-danger-btn { color: var(--red-text); border-color: var(--red-border); margin-top: 6px; }
.cpub-danger-btn:hover:not(:disabled) { background: var(--red-bg); }

.cpub-not-found { text-align: center; padding: 64px; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 12px; }

/* --- Inline media (banner + cover) in the Overview body --- */
.cpub-ce-media { display: flex; flex-direction: column; gap: 6px; }
.cpub-ce-banner {
  position: relative; width: 100%; aspect-ratio: 4 / 1; background: var(--surface2);
  border: var(--border-width-default) solid var(--border); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.cpub-ce-banner-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cpub-ce-cover {
  position: absolute; left: 16px; bottom: 12px; width: 120px; aspect-ratio: 4 / 3;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.cpub-ce-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cpub-ce-media-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-faint); }
.cpub-ce-media-placeholder > i { font-size: 24px; }
.cpub-ce-media-placeholder > span { font-size: 11px; font-family: var(--font-mono); }
.cpub-ce-media-placeholder-sm > i { font-size: 16px; }
.cpub-ce-media-placeholder-sm > span { font-size: 9px; }
.cpub-ce-media-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  background: var(--color-surface-scrim); opacity: 0; transition: opacity 0.15s;
}
.cpub-ce-banner:hover > .cpub-ce-media-overlay,
.cpub-ce-banner:focus-within > .cpub-ce-media-overlay,
.cpub-ce-cover:hover .cpub-ce-media-overlay,
.cpub-ce-cover:focus-within .cpub-ce-media-overlay { opacity: 1; }
@media (hover: none) {
  .cpub-ce-banner > .cpub-ce-media-overlay, .cpub-ce-cover .cpub-ce-media-overlay { opacity: 1; }
}
.cpub-ce-media-btn {
  font-size: 10px; padding: 5px 10px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); box-shadow: var(--shadow-sm);
}
.cpub-ce-media-btn.primary { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); }
.cpub-ce-media-btn:hover { background: var(--surface2); }
.cpub-ce-media-btn.primary:hover { opacity: 0.9; background: var(--accent); }
.cpub-ce-media-btn-icon { padding: 5px 7px; }
.cpub-ce-media-btn.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
.cpub-ce-media-hint { margin: 0; }
.cpub-ce-adjust { margin-top: 8px; padding: 10px; border: var(--border-width-default) solid var(--border); background: var(--surface2); }
.cpub-ce-cover-place { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.cpub-ce-cover-place .cpub-form-input { width: auto; flex: 1; min-width: 220px; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
/* Fit (whole image) previews: let the box grow to the image, no crop. */
.cpub-ce-banner--whole { aspect-ratio: auto; max-height: 300px; }
.cpub-ce-banner--whole .cpub-ce-banner-img { height: auto; max-height: 300px; object-fit: contain; }
.cpub-ce-cover--whole .cpub-ce-cover-img { object-fit: contain; }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* --- Responsive: stack the rail under the body on narrow viewports --- */
@media (max-width: 1024px) {
  .cpub-ce-layout { height: auto; min-height: 100vh; overflow: visible; }
  .cpub-ce-shell { flex-direction: column; overflow: visible; }
  .cpub-ce-library { width: auto; border-right: none; border-bottom: var(--border-width-default) solid var(--border); }
  .cpub-ce-center { overflow: visible; }
  .cpub-ce-settings { width: auto; border-left: none; border-top: var(--border-width-default) solid var(--border); }
  .cpub-ce-settings-body { overflow: visible; }
}
@media (max-width: 768px) {
  .cpub-ce-topbar { padding: 0 10px; }
  .cpub-ce-topbar-divider { display: none; }
  .cpub-ce-title-input { max-width: none; }
  .cpub-ce-center { padding: 12px; }
}
</style>
