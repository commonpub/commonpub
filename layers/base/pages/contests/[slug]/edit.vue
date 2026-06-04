<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { extract: extractError } = useApiError();
const { user, isAdmin } = useAuth();

const { data: contest, refresh } = useLazyFetch(`/api/contests/${slug}`);
const isOwner = computed(() => isAdmin.value || !!(user.value?.id && contest.value?.createdById === user.value.id));
useSeoMeta({ title: () => `Edit: ${contest.value?.title ?? 'Contest'} — ${useSiteName()}` });

const saving = ref(false);
const title = ref('');
// Editable slug — initialised from the loaded contest, manual override allowed.
const slugInput = ref('');
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+)|(-+$)/g, '').slice(0, 255);
}
const subheading = ref('');
const description = ref('');
const rules = ref('');
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

// Load current data
watch(contest, (c) => {
  if (!c) return;
  title.value = c.title ?? '';
  slugInput.value = c.slug ?? '';
  subheading.value = c.subheading ?? '';
  description.value = c.description ?? '';
  rules.value = c.rules ?? '';
  bannerUrl.value = c.bannerUrl ?? '';
  coverImageUrl.value = c.coverImageUrl ?? '';
  startDate.value = c.startDate ? new Date(c.startDate).toISOString().slice(0, 16) : '';
  endDate.value = c.endDate ? new Date(c.endDate).toISOString().slice(0, 16) : '';
  judgingEndDate.value = c.judgingEndDate ? new Date(c.judgingEndDate).toISOString().slice(0, 16) : '';
  communityVotingEnabled.value = !!c.communityVotingEnabled;
  judgingVisibility.value = (c.judgingVisibility as typeof judgingVisibility.value) ?? 'judges-only';
  eligibleContentTypes.value = [...(c.eligibleContentTypes ?? [])];
  maxEntriesPerUser.value = c.maxEntriesPerUser ?? null;
  visibility.value = (c.visibility as typeof visibility.value) ?? 'public';
  visibleToRoles.value = [...(c.visibleToRoles ?? [])];
  showPrizes.value = c.showPrizes !== false;
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
}, { immediate: true });

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
        rules: rules.value || undefined,
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
        prizesDescription: prizesDescription.value || undefined,
        prizes: prizeData,
        judgingCriteria: criteriaData,
      },
    });
    toast.success('Contest updated');
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

// Client mirror of the server VALID_TRANSITIONS map — bidirectional (go back a
// stage, pause/resume, reopen). Kept in sync with server/src/contest/contest.ts.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['upcoming', 'active', 'cancelled'],
  upcoming: ['draft', 'active', 'cancelled'],
  active: ['upcoming', 'paused', 'judging', 'cancelled'],
  paused: ['active', 'upcoming', 'judging', 'cancelled'],
  judging: ['active', 'paused', 'completed', 'cancelled'],
  completed: ['judging'],
  cancelled: ['draft', 'upcoming'],
};
const STATUS_ACTION: Record<string, { label: string; icon: string; tone?: 'go' | 'warn' | 'danger' }> = {
  draft: { label: 'Move to Draft', icon: 'fa-pen-ruler' },
  upcoming: { label: 'Set Upcoming', icon: 'fa-clock' },
  active: { label: 'Activate', icon: 'fa-play', tone: 'go' },
  paused: { label: 'Pause', icon: 'fa-pause', tone: 'warn' },
  judging: { label: 'Begin Judging', icon: 'fa-gavel' },
  completed: { label: 'Complete & Publish', icon: 'fa-flag-checkered', tone: 'go' },
  cancelled: { label: 'Cancel', icon: 'fa-ban', tone: 'danger' },
};
const availableTransitions = computed<string[]>(() => VALID_TRANSITIONS[contest.value?.status ?? 'upcoming'] ?? []);
function statusAction(s: string): { label: string; icon: string; tone?: string } {
  return STATUS_ACTION[s] ?? { label: s, icon: 'fa-circle' };
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
  <div v-if="contest && !isOwner" class="cpub-not-found">
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
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Details</h2>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Title</label>
          <input v-model="title" type="text" class="cpub-form-input" />
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">URL Slug</label>
          <input v-model="slugInput" type="text" class="cpub-form-input" @blur="slugInput = slugify(slugInput)" />
          <p class="cpub-form-hint">The contest URL: <code>/contests/{{ slugify(slugInput) || 'your-contest' }}</code>. Changing it breaks old links — they won't redirect.</p>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Subheading</label>
          <input v-model="subheading" type="text" maxlength="300" class="cpub-form-input" placeholder="One-line tagline shown in the contest header" />
          <p class="cpub-form-hint">Short plain-text tagline shown under the title in the hero. The Description below is the full body.</p>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Description</label>
          <textarea v-model="description" class="cpub-form-textarea" rows="4" />
          <p class="cpub-form-hint">Supports Markdown (headings, lists, bold, links) and inline HTML. Shown formatted on the contest page.</p>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Rules</label>
          <textarea v-model="rules" class="cpub-form-textarea" rows="6" placeholder="One rule per line, or full Markdown" />
          <p class="cpub-form-hint">Supports Markdown. Plain one-rule-per-line text is rendered as a numbered list.</p>
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
            <label class="cpub-form-label">Start Date</label>
            <input v-model="startDate" type="datetime-local" class="cpub-form-input" />
          </div>
          <div class="cpub-form-field">
            <label class="cpub-form-label">End Date</label>
            <input v-model="endDate" type="datetime-local" class="cpub-form-input" />
          </div>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Judging End Date</label>
          <input v-model="judgingEndDate" type="datetime-local" class="cpub-form-input" />
        </div>
        <p v-if="dateError" class="cpub-form-error" role="alert">{{ dateError }}</p>
      </section>

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
          <label class="cpub-form-label">Max entries per person</label>
          <input v-model.number="maxEntriesPerUser" type="number" min="1" class="cpub-form-input" placeholder="Unlimited" style="max-width: 160px;" />
        </div>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Prizes</h2>
        <label class="cpub-form-check" style="margin-bottom: 10px;">
          <input v-model="showPrizes" type="checkbox" />
          <span>Show the Prizes tab on the contest page</span>
        </label>
        <p v-if="!showPrizes" class="cpub-form-hint">The Prizes tab is hidden — any prizes below are saved but not shown to visitors.</p>
        <p class="cpub-form-hint">Every field is optional. Use <strong>place</strong> for ranked prizes, a <strong>category</strong> for themed awards, or just a <strong>description</strong> — whatever fits. Cash value is optional.</p>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Prizes overview (optional)</label>
          <textarea v-model="prizesDescription" class="cpub-form-textarea" rows="3" placeholder="Intro shown above the prize cards. Supports Markdown." />
          <p class="cpub-form-hint">Markdown intro displayed on the Prizes tab, above the individual prizes.</p>
        </div>
        <div v-for="(prize, i) in prizes" :key="i" class="cpub-prize-row">
          <div class="cpub-prize-header">
            <span class="cpub-prize-label">{{ prizeLabel(prize) }}</span>
            <button type="button" class="cpub-prize-remove" aria-label="Remove prize" @click="removePrize(i)"><i class="fa-solid fa-times"></i></button>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field">
              <label class="cpub-form-label">Place</label>
              <input v-model.number="prize.place" type="number" min="1" class="cpub-form-input" placeholder="1" />
            </div>
            <div class="cpub-form-field">
              <label class="cpub-form-label">Category (optional)</label>
              <input v-model="prize.category" type="text" class="cpub-form-input" placeholder="e.g. Best in Show" />
            </div>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field">
              <label class="cpub-form-label">Title</label>
              <input v-model="prize.title" type="text" class="cpub-form-input" placeholder="e.g. Gold Prize" />
            </div>
            <div class="cpub-form-field">
              <label class="cpub-form-label">Value</label>
              <input v-model="prize.value" type="text" class="cpub-form-input" placeholder="e.g. $500" />
            </div>
          </div>
          <div class="cpub-form-field">
            <label class="cpub-form-label">Description</label>
            <input v-model="prize.description" type="text" class="cpub-form-input" placeholder="Optional description" />
          </div>
        </div>
        <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize"><i class="fa-solid fa-plus"></i> Add Prize</button>
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Judging</h2>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Score Visibility</label>
          <select v-model="judgingVisibility" class="cpub-form-input">
            <option value="judges-only">Judges only — scores hidden until results</option>
            <option value="public">Public — show scores during judging</option>
            <option value="private">Private — scores stay with organizers</option>
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
              <label class="cpub-form-label">Criterion</label>
              <input v-model="crit.label" type="text" class="cpub-form-input" placeholder="e.g. Documentation" />
            </div>
            <div class="cpub-form-field" style="flex: 1">
              <label class="cpub-form-label">Points</label>
              <input v-model.number="crit.weight" type="number" min="0" max="100" class="cpub-form-input" placeholder="20" />
            </div>
            <button type="button" class="cpub-prize-remove cpub-criterion-del" aria-label="Remove criterion" @click="removeCriterion(ci)"><i class="fa-solid fa-times"></i></button>
          </div>
          <div class="cpub-form-field">
            <input v-model="crit.description" type="text" class="cpub-form-input" placeholder="What judges look for (optional)" />
          </div>
        </div>
      </section>

      <!-- Visibility & Access -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Visibility &amp; Access</h2>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Who can see this contest</label>
          <select v-model="visibility" class="cpub-form-input">
            <option value="public">Public — listed and visible to everyone</option>
            <option value="unlisted">Unlisted — visible by direct link, hidden from listings</option>
            <option value="private">Private — restricted</option>
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
        <div class="cpub-subhead">
          <h3 class="cpub-form-subtitle">Reviewers</h3>
        </div>
        <p class="cpub-form-hint">Reviewers can view this contest (even while it's private or in draft) without being a judge or an admin — view access scoped to this contest only. They can't edit or score entries.</p>
        <ContestStakeholderManager :contest-slug="slug" />
      </section>

      <!-- Judge panel (single source of truth: contest_judges table) -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Judges</h2>
        <p class="cpub-form-hint">Invited judges receive a notification and must accept before they can score.</p>
        <ContestJudgeManager :contest-slug="slug" :is-owner="true" />
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

      <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim() || !!dateError">
        <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>

      <section class="cpub-form-section cpub-danger-zone">
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
    </form>
  </div>
  <div v-else class="cpub-not-found"><p>Contest not found</p></div>
</template>

<style scoped>
.cpub-contest-edit { max-width: 700px; margin: 0 auto; padding: 32px; }
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
.cpub-form-section { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 20px; box-shadow: var(--shadow-md); }
.cpub-form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
.cpub-form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.cpub-form-input, .cpub-form-textarea { padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; }
.cpub-form-textarea { resize: vertical; }
.cpub-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

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

@media (max-width: 768px) {
  .cpub-contest-edit { padding: 16px; }
  .cpub-form-row { grid-template-columns: 1fr; }
}
</style>
