<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({ title: `Create Learning Path — ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();
const title = ref('');
const description = ref('');
const difficulty = ref('beginner');
const saving = ref(false);

async function handleCreate(): Promise<void> {
  saving.value = true;
  try {
    const result = await $fetch('/api/learn', {
      method: 'POST',
      body: { title: title.value, description: description.value, difficulty: difficulty.value },
    });
    clearNuxtData();
    await navigateTo(`/learn/${(result as { slug: string }).slug}/edit`);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="create-path-page">
    <h1 class="page-title">Create Learning Path</h1>

    <form class="path-form" @submit.prevent="handleCreate" aria-label="Create learning path">
      <div class="form-field">
        <label for="path-title" class="form-label">Title</label>
        <input id="path-title" v-model="title" type="text" class="form-input" required placeholder="Path title" />
      </div>

      <div class="form-field">
        <label for="path-desc" class="form-label">Description</label>
        <textarea id="path-desc" v-model="description" class="form-textarea" rows="3" placeholder="What will learners gain?" />
      </div>

      <div class="form-field">
        <label for="path-diff" class="form-label">Difficulty</label>
        <select id="path-diff" v-model="difficulty" class="form-select">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title">
        {{ saving ? 'Creating...' : 'Create Path' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.create-path-page { max-width: 600px; }
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }
.path-form { display: flex; flex-direction: column; gap: var(--space-4); }
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); }
.form-input, .form-textarea, .form-select { padding: var(--space-2) var(--space-3); border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-base); font-family: var(--font-sans); }
.form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.form-textarea { resize: vertical; }
/* cpub-btn, cpub-btn-primary → global components.css */
</style>
