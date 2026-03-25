<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({ title: 'Create Contest — CommonPub' });

const toast = useToast();
const { extract: extractError } = useApiError();
const saving = ref(false);

const title = ref('');
const description = ref('');
const rules = ref('');
const startDate = ref('');
const endDate = ref('');
const judgingEndDate = ref('');

// Prizes
interface Prize {
  place: number;
  title: string;
  description: string;
  value: string;
}

const prizes = ref<Prize[]>([
  { place: 1, title: '1st Place', description: '', value: '' },
  { place: 2, title: '2nd Place', description: '', value: '' },
  { place: 3, title: '3rd Place', description: '', value: '' },
]);

function addPrize(): void {
  prizes.value.push({
    place: prizes.value.length + 1,
    title: `${prizes.value.length + 1}th Place`,
    description: '',
    value: '',
  });
}

function removePrize(index: number): void {
  prizes.value.splice(index, 1);
  // Renumber
  prizes.value.forEach((p, i) => { p.place = i + 1; });
}

async function handleCreate(): Promise<void> {
  if (!title.value.trim() || !startDate.value || !endDate.value) return;
  saving.value = true;
  try {
    const result = await $fetch<{ slug: string }>('/api/contests', {
      method: 'POST',
      body: {
        title: title.value,
        description: description.value || undefined,
        rules: rules.value || undefined,
        startDate: new Date(startDate.value).toISOString(),
        endDate: new Date(endDate.value).toISOString(),
        judgingEndDate: judgingEndDate.value ? new Date(judgingEndDate.value).toISOString() : undefined,
        prizes: prizes.value.filter(p => p.title.trim()),
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

const placeLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const placeColors = ['var(--yellow)', 'var(--text-faint)', '#a0724a', 'var(--accent)', 'var(--accent)', 'var(--accent)'];
</script>

<template>
  <div class="contest-create">
    <NuxtLink to="/contests" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Contests</NuxtLink>
    <h1 class="page-title">Create Contest</h1>

    <form class="contest-form" @submit.prevent="handleCreate" aria-label="Create contest">
      <!-- Basic Info -->
      <section class="form-section">
        <h2 class="form-section-title">Contest Details</h2>
        <div class="form-field">
          <label for="contest-title" class="form-label">Title</label>
          <input id="contest-title" v-model="title" type="text" class="form-input" required placeholder="Maker Challenge 2026" />
        </div>
        <div class="form-field">
          <label for="contest-desc" class="form-label">Description</label>
          <textarea id="contest-desc" v-model="description" class="form-textarea" rows="3" placeholder="Describe your contest..." />
        </div>
        <div class="form-field">
          <label for="contest-rules" class="form-label">Rules</label>
          <textarea id="contest-rules" v-model="rules" class="form-textarea" rows="4" placeholder="Contest rules and requirements..." />
        </div>
      </section>

      <!-- Dates -->
      <section class="form-section">
        <h2 class="form-section-title">Schedule</h2>
        <div class="form-row">
          <div class="form-field">
            <label for="start-date" class="form-label">Start Date</label>
            <input id="start-date" v-model="startDate" type="datetime-local" class="form-input" required />
          </div>
          <div class="form-field">
            <label for="end-date" class="form-label">End Date</label>
            <input id="end-date" v-model="endDate" type="datetime-local" class="form-input" required />
          </div>
          <div class="form-field">
            <label for="judging-date" class="form-label">Judging Ends</label>
            <input id="judging-date" v-model="judgingEndDate" type="datetime-local" class="form-input" />
          </div>
        </div>
      </section>

      <!-- Prizes -->
      <section class="form-section">
        <div class="form-section-header">
          <h2 class="form-section-title">Prizes</h2>
          <button type="button" class="cpub-btn cpub-btn-sm" @click="addPrize">
            <i class="fa-solid fa-plus"></i> Add Prize
          </button>
        </div>

        <div v-for="(prize, idx) in prizes" :key="idx" class="prize-card">
          <div class="prize-header">
            <span class="prize-place" :style="{ color: placeColors[idx] || 'var(--accent)' }">
              <i class="fa-solid fa-trophy"></i> {{ placeLabels[idx] || `${idx + 1}th` }} Place
            </span>
            <button v-if="prizes.length > 1" type="button" class="cpub-delete-btn" @click="removePrize(idx)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="form-row">
            <div class="form-field" style="flex: 2">
              <label class="form-label">Title</label>
              <input v-model="prize.title" type="text" class="form-input" placeholder="Prize title" />
            </div>
            <div class="form-field" style="flex: 1">
              <label class="form-label">Value</label>
              <input v-model="prize.value" type="text" class="form-input" placeholder="$500" />
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Description</label>
            <input v-model="prize.description" type="text" class="form-input" placeholder="What the winner receives..." />
          </div>
        </div>
      </section>

      <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-lg" :disabled="saving || !title.trim() || !startDate || !endDate">
        <i class="fa-solid fa-trophy"></i> {{ saving ? 'Creating...' : 'Create Contest' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.contest-create { max-width: 720px; margin: 0 auto; padding: 32px; }

.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }

.page-title { font-size: 24px; font-weight: 700; margin-bottom: 24px; letter-spacing: -0.02em; }

.contest-form { display: flex; flex-direction: column; gap: 20px; }

.form-section { border: 2px solid var(--border); background: var(--surface); padding: 20px; box-shadow: 4px 4px 0 var(--border); }
.form-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
.form-section-header .form-section-title { margin-bottom: 0; }

.form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.form-field:last-child { margin-bottom: 0; }
.form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.form-input, .form-textarea { padding: 8px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; }
.form-input:focus, .form-textarea:focus { border-color: var(--accent); outline: none; }
.form-textarea { resize: vertical; }
.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }

.prize-card { border: 2px solid var(--border); padding: 14px; margin-bottom: 10px; background: var(--surface2); }
.prize-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.prize-place { font-size: 12px; font-weight: 700; font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; }

</style>
