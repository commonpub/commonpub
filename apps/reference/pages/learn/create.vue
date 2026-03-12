<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({ title: 'Create Learning Path — CommonPub' });

const title = ref('');
const description = ref('');
const difficulty = ref('beginner');
const saving = ref(false);
const error = ref('');

async function handleCreate(): Promise<void> {
  saving.value = true;
  error.value = '';
  try {
    const result = await $fetch('/api/learn', {
      method: 'POST',
      body: { title: title.value, description: description.value, difficulty: difficulty.value },
    });
    await navigateTo(`/learn/${(result as { slug: string }).slug}`);
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to create path.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="create-path-page">
    <h1 class="page-title">Create Learning Path</h1>

    <form class="path-form" @submit.prevent="handleCreate" aria-label="Create learning path">
      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

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

      <button type="submit" class="cpub-btn-primary" :disabled="saving || !title">
        {{ saving ? 'Creating...' : 'Create Path' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.create-path-page { max-width: 600px; }
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }
.path-form { display: flex; flex-direction: column; gap: var(--space-4); }
.form-error { padding: var(--space-3); background: var(--red-bg, var(--surface2)); color: var(--red, var(--text)); border: 1px solid var(--red, var(--border)); font-size: var(--text-sm); }
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); }
.form-input, .form-textarea, .form-select { padding: var(--space-2) var(--space-3); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: var(--text-base); font-family: var(--font-sans); }
.form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.form-textarea { resize: vertical; }
.cpub-btn-primary { padding: var(--space-2) var(--space-4); background: var(--accent); color: var(--color-on-primary); border: 1px solid var(--border); font-size: var(--text-sm); font-weight: var(--font-weight-medium); font-family: var(--font-sans); cursor: pointer; align-self: flex-start; }
.cpub-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
