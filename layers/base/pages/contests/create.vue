<script setup lang="ts">
import type { ContestStage } from '@commonpub/schema';

definePageMeta({ middleware: 'auth' });

useSeoMeta({ title: `Create Contest, ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();
const saving = ref(false);

const title = ref('');
// Slug auto-derives from the title until the operator edits it manually.
const slug = ref('');
const slugTouched = ref(false);
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+)|(-+$)/g, '').slice(0, 255);
}
watch(title, (t) => { if (!slugTouched.value) slug.value = slugify(t); });
const subheading = ref('');
const description = ref('');
const rules = ref('');
const contentFormat = ref<'markdown' | 'html'>('markdown');
const bannerUrl = ref('');
const coverImageUrl = ref('');
const startDate = ref('');
const endDate = ref('');
const judgingEndDate = ref('');
const communityVotingEnabled = ref(false);
const judgingVisibility = ref<'public' | 'judges-only' | 'private'>('judges-only');

// Visibility & access
const visibility = ref<'public' | 'unlisted' | 'private'>('public');
const visibleToRoles = ref<string[]>([]);
const ROLE_OPTIONS = ['member', 'pro', 'verified', 'staff', 'admin'];
function toggleRole(r: string): void {
  const i = visibleToRoles.value.indexOf(r);
  if (i >= 0) visibleToRoles.value.splice(i, 1);
  else visibleToRoles.value.push(r);
}

// Entry rules
const { enabledTypeMeta } = useContentTypes();
const eligibleContentTypes = ref<string[]>([]); // empty = all types allowed
const maxEntriesPerUser = ref<number | null>(null);
function toggleType(type: string): void {
  const i = eligibleContentTypes.value.indexOf(type);
  if (i >= 0) eligibleContentTypes.value.splice(i, 1);
  else eligibleContentTypes.value.push(type);
}

// Prizes
interface Prize {
  place: number | null;
  category: string;
  title: string;
  description: string;
  value: string;
}

const showPrizes = ref(true);
const prizesDescription = ref('');

// Phase B1 — explicit stage timeline (empty ⇒ standard synthesized flow).
const stages = ref<ContestStage[]>([]);
const currentStageIdRef = ref<string | null>(null);
// Prizes are entirely optional — start empty so a contest has NO prizes unless
// the operator explicitly adds them (the old 3 pre-filled rows forced prizes
// onto every contest, since their non-empty titles survived the submit filter).
const prizes = ref<Prize[]>([]);

function addPrize(): void {
  prizes.value.push({ place: null, category: '', title: '', description: '', value: '' });
}

function removePrize(index: number): void {
  prizes.value.splice(index, 1);
}

// Judging criteria (rubric)
interface Criterion { label: string; weight: number | null; description: string }
const criteria = ref<Criterion[]>([]);
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

async function handleCreate(): Promise<void> {
  if (!title.value.trim() || !startDate.value || !endDate.value) return;
  if (dateError.value) { toast.error(dateError.value); return; }
  saving.value = true;
  try {
    const result = await $fetch<{ slug: string }>('/api/contests', {
      method: 'POST',
      body: {
        title: title.value,
        slug: slugify(slug.value) || undefined,
        subheading: subheading.value || undefined,
        description: description.value || undefined,
        rules: rules.value || undefined,
        contentFormat: contentFormat.value,
        bannerUrl: bannerUrl.value || undefined,
        coverImageUrl: coverImageUrl.value || undefined,
        startDate: new Date(startDate.value).toISOString(),
        endDate: new Date(endDate.value).toISOString(),
        judgingEndDate: judgingEndDate.value ? new Date(judgingEndDate.value).toISOString() : undefined,
        communityVotingEnabled: communityVotingEnabled.value,
        judgingVisibility: judgingVisibility.value,
        visibility: visibility.value,
        visibleToRoles: visibility.value === 'private' && visibleToRoles.value.length ? visibleToRoles.value : undefined,
        eligibleContentTypes: eligibleContentTypes.value.length ? eligibleContentTypes.value : undefined,
        maxEntriesPerUser: maxEntriesPerUser.value && maxEntriesPerUser.value > 0 ? maxEntriesPerUser.value : undefined,
        showPrizes: showPrizes.value,
        stages: stages.value.length ? stages.value : undefined,
        currentStageId: currentStageIdRef.value ?? undefined,
        prizesDescription: prizesDescription.value || undefined,
        prizes: prizes.value
          .filter(p => p.title.trim() || p.description.trim() || p.category.trim() || (typeof p.place === 'number' && p.place > 0))
          .map(p => ({
            place: typeof p.place === 'number' && Number.isFinite(p.place) && p.place > 0 ? p.place : undefined,
            category: p.category.trim() || undefined,
            title: p.title.trim() || undefined,
            description: p.description.trim() || undefined,
            value: p.value.trim() || undefined,
          })),
        judgingCriteria: criteria.value
          .filter(c => c.label.trim())
          .map(c => ({
            label: c.label.trim(),
            weight: typeof c.weight === 'number' && Number.isFinite(c.weight) ? c.weight : undefined,
            description: c.description.trim() || undefined,
          })),
      },
    });
    toast.success('Contest created!');
    await navigateTo(`/contests/${result.slug}`);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}

function prizeLabel(prize: Prize): string {
  if (prize.category.trim()) return prize.category;
  if (prize.place && prize.place > 0) {
    const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    return `${labels[prize.place - 1] || `${prize.place}th`} Place`;
  }
  return 'Prize';
}
</script>

<template>
  <div class="cpub-contest-create">
    <NuxtLink to="/contests" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Contests</NuxtLink>
    <h1 class="cpub-page-title">Create Contest</h1>

    <form class="cpub-contest-form" @submit.prevent="handleCreate" aria-label="Create contest">
      <!-- Basic Info -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Contest Details</h2>
        <div class="cpub-form-field">
          <label for="contest-title" class="cpub-form-label">Title</label>
          <input id="contest-title" v-model="title" type="text" class="cpub-form-input" required placeholder="Maker Challenge 2026" />
        </div>
        <div class="cpub-form-field">
          <label for="contest-slug" class="cpub-form-label">URL Slug</label>
          <input id="contest-slug" v-model="slug" type="text" class="cpub-form-input" placeholder="auto-generated from title" @input="slugTouched = true" @blur="slug = slugify(slug)" />
          <p class="cpub-form-hint">Auto-fills from the title. Edit to set a custom URL: <code>/contests/{{ slugify(slug) || 'your-contest' }}</code></p>
        </div>
        <div class="cpub-form-field">
          <label for="contest-subheading" class="cpub-form-label">Subheading</label>
          <input id="contest-subheading" v-model="subheading" type="text" maxlength="300" class="cpub-form-input" placeholder="One-line tagline shown in the contest header" />
          <p class="cpub-form-hint">Short plain-text tagline shown under the title in the hero. The Description below is the full body.</p>
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Content format</label>
          <div class="cpub-type-options" role="radiogroup" aria-label="Content format">
            <label class="cpub-form-check"><input v-model="contentFormat" type="radio" value="markdown" /> <span>Markdown</span></label>
            <label class="cpub-form-check"><input v-model="contentFormat" type="radio" value="html" /> <span>Full HTML</span></label>
          </div>
          <p class="cpub-form-hint">
            Applies to Description, Rules, and the Prizes overview. <strong>Markdown</strong> supports headings, lists, links, and safe inline HTML.
            <strong>Full HTML</strong> renders your raw HTML, CSS, and SVG as-is (scripts and event handlers are removed for safety).
          </p>
        </div>
        <div class="cpub-form-field">
          <label for="contest-desc" class="cpub-form-label">Description</label>
          <textarea id="contest-desc" v-model="description" class="cpub-form-textarea" rows="4" maxlength="50000" placeholder="Describe your contest. Supports Markdown, # headings, - lists, **bold**, [links](url)…" />
          <p class="cpub-form-hint">{{ contentFormat === 'html' ? 'Rendered as full HTML/CSS/SVG.' : 'Supports Markdown (headings, lists, bold, links) and inline HTML.' }} Shown formatted on the contest page.</p>
        </div>
        <div class="cpub-form-field">
          <label for="contest-rules" class="cpub-form-label">Rules</label>
          <textarea id="contest-rules" v-model="rules" class="cpub-form-textarea" rows="6" maxlength="50000" placeholder="Contest rules and requirements. Supports Markdown, one rule per line, or full Markdown." />
          <p class="cpub-form-hint">Supports Markdown. Plain one-rule-per-line text is rendered as a numbered list.</p>
        </div>
        <div class="cpub-form-field">
          <ImageUpload v-model="bannerUrl" purpose="banner" label="Banner Image" hint="Wide hero image across the top of the contest page (~4:1)." />
        </div>
        <div class="cpub-form-field">
          <ImageUpload v-model="coverImageUrl" purpose="cover" label="Cover Image (optional)" hint="Card/thumbnail image shown in listings (~4:3). Falls back to the banner if unset." />
        </div>
      </section>

      <!-- Dates -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Schedule</h2>
        <div class="cpub-form-row">
          <div class="cpub-form-field">
            <label for="start-date" class="cpub-form-label">Start Date</label>
            <input id="start-date" v-model="startDate" type="datetime-local" class="cpub-form-input" required />
          </div>
          <div class="cpub-form-field">
            <label for="end-date" class="cpub-form-label">End Date</label>
            <input id="end-date" v-model="endDate" type="datetime-local" class="cpub-form-input" required />
          </div>
          <div class="cpub-form-field">
            <label for="judging-date" class="cpub-form-label">Judging Ends</label>
            <input id="judging-date" v-model="judgingEndDate" type="datetime-local" class="cpub-form-input" />
          </div>
        </div>
        <p v-if="dateError" class="cpub-form-error" role="alert">{{ dateError }}</p>
      </section>

      <!-- Stages -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Stages <span style="color: var(--text-faint); font-weight: 400; font-size: 0.75em; font-family: var(--font-mono);">- optional</span></h2>
        <p class="cpub-form-hint">The standard flow (Submissions → Judging → Results) is derived from the schedule above. Add custom stages for multi-round contests, proposal rounds, a Top-N selection, a build sprint, multiple judging rounds, or a showcase event.</p>
        <ContestStagesEditor
          v-model="stages"
          v-model:current-stage-id="currentStageIdRef"
          :start-date="startDate"
          :end-date="endDate"
          :judging-end-date="judgingEndDate"
        />
      </section>

      <!-- Visibility & Access -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Visibility &amp; Access</h2>
        <div class="cpub-form-field">
          <label for="visibility" class="cpub-form-label">Who can see this contest</label>
          <select id="visibility" v-model="visibility" class="cpub-form-input">
            <option value="public">Public, listed and visible to everyone</option>
            <option value="unlisted">Unlisted, visible by direct link, hidden from listings</option>
            <option value="private">Private, restricted (you can publish it later)</option>
          </select>
        </div>
        <div v-if="visibility === 'private'" class="cpub-form-field">
          <span class="cpub-form-label">Also visible to roles</span>
          <p class="cpub-form-hint">Owner, admins, judges, and reviewers (added after creation) can always see it. Optionally grant whole roles too.</p>
          <div class="cpub-type-options" role="group" aria-label="Roles that can view">
            <label v-for="r in ROLE_OPTIONS" :key="r" class="cpub-form-check">
              <input type="checkbox" :checked="visibleToRoles.includes(r)" @change="toggleRole(r)" />
              <span>{{ r }}</span>
            </label>
          </div>
        </div>
        <p v-if="visibility === 'private'" class="cpub-form-hint">Add named reviewers (stakeholders) from the contest's Edit page after creating it.</p>
      </section>

      <!-- Entry Rules -->
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
          <label for="max-entries" class="cpub-form-label">Max entries per person</label>
          <input id="max-entries" v-model.number="maxEntriesPerUser" type="number" min="1" class="cpub-form-input" placeholder="Unlimited" style="max-width: 160px;" />
        </div>
      </section>

      <!-- Judging -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Judging</h2>
        <div class="cpub-form-field">
          <label for="judging-visibility" class="cpub-form-label">Score Visibility</label>
          <select id="judging-visibility" v-model="judgingVisibility" class="cpub-form-input">
            <option value="judges-only">Judges only, scores hidden until results</option>
            <option value="public">Public, show scores during judging</option>
            <option value="private">Private, scores stay with organizers</option>
          </select>
        </div>
        <label class="cpub-form-check">
          <input v-model="communityVotingEnabled" type="checkbox" />
          <span>Enable community voting (let signed-in members upvote entries)</span>
        </label>

        <div class="cpub-form-section-header" style="margin-top: 16px;">
          <h3 class="cpub-form-subtitle">Judging Criteria <span v-if="criteriaTotal" class="cpub-form-hint-inline">{{ criteriaTotal }} pts</span></h3>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addCriterion"><i class="fa-solid fa-plus"></i> Add Criterion</button>
        </div>
        <p v-if="!criteria.length" class="cpub-form-hint">Optional rubric shown to entrants and judges (e.g. Documentation, 20 pts).</p>
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
            <button type="button" class="cpub-delete-btn cpub-criterion-del" aria-label="Remove criterion" @click="removeCriterion(ci)"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="cpub-form-field">
            <input v-model="crit.description" type="text" class="cpub-form-input" placeholder="What judges look for (optional)" />
          </div>
        </div>
      </section>

      <!-- Prizes -->
      <section class="cpub-form-section">
        <div class="cpub-form-section-header">
          <h2 class="cpub-form-section-title">Prizes <span style="color: var(--text-faint); font-weight: 400; font-size: 0.75em; font-family: var(--font-mono);">- optional</span></h2>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize">
            <i class="fa-solid fa-plus"></i> Add Prize
          </button>
        </div>

        <label class="cpub-form-check">
          <input v-model="showPrizes" type="checkbox" />
          <span>Show the Prizes tab on the contest page</span>
        </label>
        <p v-if="!showPrizes" class="cpub-form-hint">The Prizes tab is hidden, any prizes below are saved but not shown to visitors.</p>

        <p class="cpub-form-hint">Contests don't need prizes, leave this empty to skip them entirely. If you do add prizes, every field is optional: use <strong>place</strong> for ranked prizes (1st/2nd/3rd), a <strong>category</strong> for themed awards (e.g. "Best in Show"), or just a <strong>description</strong>. Cash value is optional.</p>
        <div class="cpub-form-field">
          <label for="prizes-desc" class="cpub-form-label">Prizes overview (optional)</label>
          <textarea id="prizes-desc" v-model="prizesDescription" class="cpub-form-textarea" rows="3" maxlength="50000" placeholder="Intro shown above the prize cards. Supports Markdown." />
          <p class="cpub-form-hint">Markdown intro displayed on the Prizes tab, above the individual prizes.</p>
        </div>
        <div v-for="(prize, idx) in prizes" :key="idx" class="cpub-prize-card">
          <div class="cpub-prize-header">
            <span class="cpub-prize-place">
              <i class="fa-solid fa-trophy"></i> {{ prizeLabel(prize) }}
            </span>
            <button type="button" class="cpub-delete-btn" aria-label="Remove prize" @click="removePrize(idx)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field" style="flex: 1">
              <label class="cpub-form-label">Place</label>
              <input v-model.number="prize.place" type="number" min="1" class="cpub-form-input" placeholder="1" />
            </div>
            <div class="cpub-form-field" style="flex: 2">
              <label class="cpub-form-label">Category (optional)</label>
              <input v-model="prize.category" type="text" class="cpub-form-input" placeholder="e.g. Best in Show" />
            </div>
          </div>
          <div class="cpub-form-row">
            <div class="cpub-form-field" style="flex: 2">
              <label class="cpub-form-label">Title</label>
              <input v-model="prize.title" type="text" class="cpub-form-input" placeholder="Prize title" />
            </div>
            <div class="cpub-form-field" style="flex: 1">
              <label class="cpub-form-label">Value</label>
              <input v-model="prize.value" type="text" class="cpub-form-input" placeholder="$500" />
            </div>
          </div>
          <div class="cpub-form-field">
            <label class="cpub-form-label">Description</label>
            <input v-model="prize.description" type="text" class="cpub-form-input" placeholder="What the winner receives..." />
          </div>
        </div>
      </section>

      <div class="cpub-edit-actionbar">
        <span class="cpub-edit-actionbar-hint">Required: title, start &amp; end dates.</span>
        <div class="cpub-edit-actionbar-btns">
          <NuxtLink to="/contests" class="cpub-btn">Cancel</NuxtLink>
          <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim() || !startDate || !endDate || !!dateError">
            <i class="fa-solid fa-trophy"></i> {{ saving ? 'Creating…' : 'Create Contest' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cpub-contest-create { max-width: 720px; margin: 0 auto; padding: 32px; }

.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }

.cpub-page-title { font-size: 24px; font-weight: 700; margin-bottom: 24px; letter-spacing: -0.02em; }

.cpub-contest-form { display: flex; flex-direction: column; gap: 20px; }

.cpub-form-section { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 20px; box-shadow: var(--shadow-md); }
.cpub-form-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cpub-form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
.cpub-form-section-header .cpub-form-section-title { margin-bottom: 0; }

.cpub-form-field { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-input, .cpub-form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-sm); font-family: var(--font-sans); }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-form-textarea { resize: vertical; }
.cpub-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); }

.cpub-prize-card { border: var(--border-width-default) solid var(--border); padding: 14px; margin-bottom: 10px; background: var(--surface2); }
.cpub-prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpub-prize-place { font-size: 12px; font-weight: 700; font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; color: var(--accent); }

.cpub-form-error { font-size: 12px; color: var(--red); margin-top: 8px; }
.cpub-form-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); cursor: pointer; margin-top: 4px; }
.cpub-form-check input { width: 14px; height: 14px; }
.cpub-type-options { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; }
.cpub-form-subtitle { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; }
.cpub-form-hint-inline { font-size: 10px; color: var(--accent); }
.cpub-form-hint { font-size: 11px; color: var(--text-faint); margin: 8px 0; line-height: 1.5; }
.cpub-criterion-row { border: var(--border-width-default) solid var(--border); padding: 12px; margin-bottom: 8px; background: var(--surface2); }
.cpub-criterion-row .cpub-form-row { align-items: flex-end; }
.cpub-criterion-del { align-self: flex-end; margin-bottom: 12px; }
.cpub-delete-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px; }
.cpub-delete-btn:hover { color: var(--red); }

/* Sticky create bar — Create button always reachable on the long form. */
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
.cpub-edit-actionbar-hint { font-size: 11px; color: var(--text-faint); }
.cpub-edit-actionbar-btns { display: flex; align-items: center; gap: 8px; }

@media (max-width: 768px) {
  .cpub-contest-create { padding: 16px; }
  .cpub-page-title { font-size: 20px; }
  .cpub-form-section { padding: 14px; }
  .cpub-form-row { grid-template-columns: 1fr; }
  .cpub-edit-actionbar { margin: 4px -16px -16px; padding: 12px 16px; }
}
</style>
