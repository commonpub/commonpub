<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({ title: `Create Contest — ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();
const saving = ref(false);

const title = ref('');
const description = ref('');
const rules = ref('');
const bannerUrl = ref('');
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

const prizes = ref<Prize[]>([
  { place: 1, category: '', title: '1st Place', description: '', value: '' },
  { place: 2, category: '', title: '2nd Place', description: '', value: '' },
  { place: 3, category: '', title: '3rd Place', description: '', value: '' },
]);

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
        description: description.value || undefined,
        rules: rules.value || undefined,
        bannerUrl: bannerUrl.value || undefined,
        startDate: new Date(startDate.value).toISOString(),
        endDate: new Date(endDate.value).toISOString(),
        judgingEndDate: judgingEndDate.value ? new Date(judgingEndDate.value).toISOString() : undefined,
        communityVotingEnabled: communityVotingEnabled.value,
        judgingVisibility: judgingVisibility.value,
        visibility: visibility.value,
        visibleToRoles: visibility.value === 'private' && visibleToRoles.value.length ? visibleToRoles.value : undefined,
        eligibleContentTypes: eligibleContentTypes.value.length ? eligibleContentTypes.value : undefined,
        maxEntriesPerUser: maxEntriesPerUser.value && maxEntriesPerUser.value > 0 ? maxEntriesPerUser.value : undefined,
        prizes: prizes.value
          .filter(p => p.title.trim())
          .map(p => ({
            place: typeof p.place === 'number' && Number.isFinite(p.place) && p.place > 0 ? p.place : undefined,
            category: p.category.trim() || undefined,
            title: p.title,
            description: p.description || undefined,
            value: p.value || undefined,
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

function prizeLabel(prize: Prize, idx: number): string {
  if (prize.category.trim()) return prize.category;
  const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  return `${labels[idx] || `${idx + 1}th`} Place`;
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
          <label for="contest-desc" class="cpub-form-label">Description</label>
          <textarea id="contest-desc" v-model="description" class="cpub-form-textarea" rows="3" placeholder="Describe your contest..." />
        </div>
        <div class="cpub-form-field">
          <label for="contest-rules" class="cpub-form-label">Rules</label>
          <textarea id="contest-rules" v-model="rules" class="cpub-form-textarea" rows="4" placeholder="Contest rules and requirements (one per line)..." />
        </div>
        <div class="cpub-form-field">
          <label for="contest-banner" class="cpub-form-label">Banner Image URL</label>
          <input id="contest-banner" v-model="bannerUrl" type="url" class="cpub-form-input" placeholder="https://..." />
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

      <!-- Visibility & Access -->
      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Visibility &amp; Access</h2>
        <div class="cpub-form-field">
          <label for="visibility" class="cpub-form-label">Who can see this contest</label>
          <select id="visibility" v-model="visibility" class="cpub-form-input">
            <option value="public">Public — listed and visible to everyone</option>
            <option value="unlisted">Unlisted — visible by direct link, hidden from listings</option>
            <option value="private">Private — restricted (you can publish it later)</option>
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
            <option value="judges-only">Judges only — scores hidden until results</option>
            <option value="public">Public — show scores during judging</option>
            <option value="private">Private — scores stay with organizers</option>
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
        <p v-if="!criteria.length" class="cpub-form-hint">Optional rubric shown to entrants and judges (e.g. Documentation — 20 pts).</p>
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
          <h2 class="cpub-form-section-title">Prizes</h2>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize">
            <i class="fa-solid fa-plus"></i> Add Prize
          </button>
        </div>

        <p class="cpub-form-hint">Use <strong>place</strong> for ranked prizes (1st/2nd/3rd) or a <strong>category</strong> for themed awards (e.g. "Best in Show").</p>
        <div v-for="(prize, idx) in prizes" :key="idx" class="cpub-prize-card">
          <div class="cpub-prize-header">
            <span class="cpub-prize-place">
              <i class="fa-solid fa-trophy"></i> {{ prizeLabel(prize, idx) }}
            </span>
            <button v-if="prizes.length > 1" type="button" class="cpub-delete-btn" aria-label="Remove prize" @click="removePrize(idx)">
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

      <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-lg" :disabled="saving || !title.trim() || !startDate || !endDate || !!dateError">
        <i class="fa-solid fa-trophy"></i> {{ saving ? 'Creating...' : 'Create Contest' }}
      </button>
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

.cpub-form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.cpub-form-field:last-child { margin-bottom: 0; }
.cpub-form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.cpub-form-input, .cpub-form-textarea { padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; }
.cpub-form-input:focus, .cpub-form-textarea:focus { border-color: var(--accent); outline: none; }
.cpub-form-textarea { resize: vertical; }
.cpub-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }

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

@media (max-width: 768px) {
  .cpub-contest-create { padding: 16px; }
  .cpub-page-title { font-size: 20px; }
  .cpub-form-section { padding: 14px; }
  .cpub-form-row { grid-template-columns: 1fr; }
}
</style>
