<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { extract: extractError } = useApiError();

const { data: contest, refresh } = useLazyFetch(`/api/contests/${slug}`);
useSeoMeta({ title: () => `Edit: ${contest.value?.title ?? 'Contest'} — ${useSiteName()}` });

const saving = ref(false);
const title = ref('');
const description = ref('');
const rules = ref('');
const startDate = ref('');
const endDate = ref('');
const judgingEndDate = ref('');
const prizes = ref<Array<{ place: number; title: string; description: string; value: string }>>([]);
const judgeUsernames = ref('');

// Load current data
watch(contest, (c) => {
  if (!c) return;
  title.value = c.title ?? '';
  description.value = c.description ?? '';
  rules.value = c.rules ?? '';
  startDate.value = c.startDate ? new Date(c.startDate).toISOString().slice(0, 16) : '';
  endDate.value = c.endDate ? new Date(c.endDate).toISOString().slice(0, 16) : '';
  judgingEndDate.value = c.judgingEndDate ? new Date(c.judgingEndDate).toISOString().slice(0, 16) : '';
  prizes.value = (c.prizes ?? []).map((p: { place: number; title: string; description?: string; value?: string }) => ({
    place: p.place,
    title: p.title,
    description: p.description ?? '',
    value: p.value ?? '',
  }));
}, { immediate: true });

function addPrize(): void {
  const nextPlace = prizes.value.length + 1;
  prizes.value.push({ place: nextPlace, title: '', description: '', value: '' });
}

function removePrize(index: number): void {
  prizes.value.splice(index, 1);
  prizes.value.forEach((p, i) => { p.place = i + 1; });
}

function placeLabel(place: number): string {
  if (place === 1) return '1st Place';
  if (place === 2) return '2nd Place';
  if (place === 3) return '3rd Place';
  return `${place}th Place`;
}

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    const prizeData = prizes.value
      .filter((p) => p.title.trim())
      .map((p) => ({
        place: p.place,
        title: p.title,
        description: p.description || undefined,
        value: p.value || undefined,
      }));

    await $fetch(`/api/contests/${slug}`, {
      method: 'PUT',
      body: {
        title: title.value,
        description: description.value || undefined,
        rules: rules.value || undefined,
        startDate: startDate.value ? new Date(startDate.value).toISOString() : undefined,
        endDate: endDate.value ? new Date(endDate.value).toISOString() : undefined,
        judgingEndDate: judgingEndDate.value ? new Date(judgingEndDate.value).toISOString() : undefined,
        prizes: prizeData.length > 0 ? prizeData : undefined,
      },
    });
    toast.success('Contest updated');
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}

async function transitionStatus(newStatus: string): Promise<void> {
  const msg = newStatus === 'cancelled'
    ? 'Cancel this contest? This cannot be undone.'
    : `Change contest status to "${newStatus}"?`;
  if (!confirm(msg)) return;
  try {
    await $fetch(`/api/contests/${slug}/transition`, {
      method: 'POST',
      body: { status: newStatus },
    });
    toast.success(`Status changed to ${newStatus}`);
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}
</script>

<template>
  <div v-if="contest" class="cpub-contest-edit">
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
          <label class="cpub-form-label">Description</label>
          <textarea v-model="description" class="cpub-form-textarea" rows="3" />
        </div>
        <div class="cpub-form-field">
          <label class="cpub-form-label">Rules</label>
          <textarea v-model="rules" class="cpub-form-textarea" rows="4" placeholder="One rule per line" />
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
      </section>

      <section class="cpub-form-section">
        <h2 class="cpub-form-section-title">Prizes</h2>
        <div v-for="(prize, i) in prizes" :key="i" class="cpub-prize-row">
          <div class="cpub-prize-header">
            <span class="cpub-prize-label">{{ placeLabel(prize.place) }}</span>
            <button type="button" class="cpub-prize-remove" @click="removePrize(i)"><i class="fa-solid fa-times"></i></button>
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
        <h2 class="cpub-form-section-title">Status Transitions</h2>
        <div class="cpub-status-actions">
          <button v-if="contest.status === 'upcoming'" type="button" class="cpub-btn cpub-transition-btn cpub-transition-activate" @click="transitionStatus('active')">
            <i class="fa-solid fa-play"></i> Start Contest
          </button>
          <button v-if="contest.status === 'active'" type="button" class="cpub-btn cpub-transition-btn cpub-transition-judging" @click="transitionStatus('judging')">
            <i class="fa-solid fa-gavel"></i> Begin Judging
          </button>
          <button v-if="contest.status === 'judging'" type="button" class="cpub-btn cpub-transition-btn cpub-transition-complete" @click="transitionStatus('completed')">
            <i class="fa-solid fa-flag-checkered"></i> Complete
          </button>
          <button
            v-if="contest.status !== 'completed' && contest.status !== 'cancelled'"
            type="button"
            class="cpub-btn cpub-transition-btn cpub-transition-cancel"
            @click="transitionStatus('cancelled')"
          >
            <i class="fa-solid fa-ban"></i> Cancel Contest
          </button>
        </div>
      </section>

      <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim()">
        <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>
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
.cpub-status-upcoming { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
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

.cpub-prize-row { border: var(--border-width-default) solid var(--border); padding: 14px; margin-bottom: 10px; background: var(--surface2); }
.cpub-prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpub-prize-label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; }
.cpub-prize-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; }
.cpub-prize-remove:hover { color: var(--red); }

.cpub-status-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.cpub-transition-btn { display: inline-flex; align-items: center; gap: 6px; }
.cpub-transition-activate { color: var(--green); border-color: var(--green-border); }
.cpub-transition-judging { color: var(--yellow); border-color: var(--yellow-border); }
.cpub-transition-complete { color: var(--accent); border-color: var(--accent-border); }
.cpub-transition-cancel { color: var(--red); border-color: var(--red-border); }

.cpub-not-found { text-align: center; padding: 64px; color: var(--text-dim); }
</style>
