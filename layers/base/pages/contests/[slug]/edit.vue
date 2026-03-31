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

// Load current data
watch(contest, (c) => {
  if (!c) return;
  title.value = c.title ?? '';
  description.value = c.description ?? '';
  rules.value = c.rules ?? '';
  startDate.value = c.startDate ? new Date(c.startDate).toISOString().slice(0, 16) : '';
  endDate.value = c.endDate ? new Date(c.endDate).toISOString().slice(0, 16) : '';
}, { immediate: true });

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch(`/api/contests/${slug}`, {
      method: 'PUT',
      body: {
        title: title.value,
        description: description.value || undefined,
        rules: rules.value || undefined,
        startDate: startDate.value ? new Date(startDate.value).toISOString() : undefined,
        endDate: endDate.value ? new Date(endDate.value).toISOString() : undefined,
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
  if (!confirm(`Change contest status to "${newStatus}"?`)) return;
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
  <div v-if="contest" class="contest-edit">
    <NuxtLink :to="`/contests/${slug}`" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Back to contest</NuxtLink>
    <h1 class="page-title">Edit Contest</h1>
    <p class="page-subtitle">
      Status: <span class="status-badge" :class="`status-${contest.status}`">{{ contest.status }}</span>
    </p>

    <form class="edit-form" @submit.prevent="handleSave">
      <section class="form-section">
        <h2 class="form-section-title">Details</h2>
        <div class="form-field">
          <label class="form-label">Title</label>
          <input v-model="title" type="text" class="form-input" />
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <textarea v-model="description" class="form-textarea" rows="3" />
        </div>
        <div class="form-field">
          <label class="form-label">Rules</label>
          <textarea v-model="rules" class="form-textarea" rows="4" />
        </div>
      </section>

      <section class="form-section">
        <h2 class="form-section-title">Schedule</h2>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Start Date</label>
            <input v-model="startDate" type="datetime-local" class="form-input" />
          </div>
          <div class="form-field">
            <label class="form-label">End Date</label>
            <input v-model="endDate" type="datetime-local" class="form-input" />
          </div>
        </div>
      </section>

      <section class="form-section">
        <h2 class="form-section-title">Status Transitions</h2>
        <div class="status-actions">
          <button v-if="contest.status === 'upcoming'" type="button" class="cpub-btn" style="color: var(--green); border-color: var(--green-border);" @click="transitionStatus('active')">
            <i class="fa-solid fa-play"></i> Start Contest
          </button>
          <button v-if="contest.status === 'active'" type="button" class="cpub-btn" style="color: var(--yellow); border-color: var(--yellow-border);" @click="transitionStatus('judging')">
            <i class="fa-solid fa-gavel"></i> Begin Judging
          </button>
          <button v-if="contest.status === 'judging'" type="button" class="cpub-btn" style="color: var(--accent); border-color: var(--accent-border);" @click="transitionStatus('completed')">
            <i class="fa-solid fa-flag-checkered"></i> Complete
          </button>
        </div>
      </section>

      <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim()">
        <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>
    </form>
  </div>
  <div v-else class="not-found"><p>Contest not found</p></div>
</template>

<style scoped>
.contest-edit { max-width: 700px; margin: 0 auto; padding: 32px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
.status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: 2px solid; }
.status-upcoming { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }

.edit-form { display: flex; flex-direction: column; gap: 16px; }
.form-section { border: 2px solid var(--border); background: var(--surface); padding: 20px; box-shadow: var(--shadow-md); }
.form-section-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
.form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.form-field:last-child { margin-bottom: 0; }
.form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.form-input, .form-textarea { padding: 8px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; }
.form-input:focus, .form-textarea:focus { border-color: var(--accent); outline: none; }
.form-textarea { resize: vertical; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.status-actions { display: flex; gap: 8px; }

.not-found { text-align: center; padding: 64px; color: var(--text-dim); }
</style>
