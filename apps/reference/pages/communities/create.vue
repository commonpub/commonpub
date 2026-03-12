<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: 'Create Community — CommonPub',
  description: 'Create a new maker community.',
});

const name = ref('');
const description = ref('');
const saving = ref(false);
const error = ref('');

async function handleCreate(): Promise<void> {
  saving.value = true;
  error.value = '';
  try {
    const result = await $fetch('/api/communities', {
      method: 'POST',
      body: { name: name.value, description: description.value },
    });
    await navigateTo(`/communities/${(result as { slug: string }).slug}`);
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to create community.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="create-community-page">
    <h1 class="page-title">Create Community</h1>

    <form class="community-form" @submit.prevent="handleCreate" aria-label="Create community form">
      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

      <div class="form-field">
        <label for="community-name" class="form-label">Name</label>
        <input id="community-name" v-model="name" type="text" class="form-input" required placeholder="Community name" />
      </div>

      <div class="form-field">
        <label for="community-desc" class="form-label">Description</label>
        <textarea id="community-desc" v-model="description" class="form-textarea" rows="3" placeholder="What is this community about?" />
      </div>

      <button type="submit" class="cpub-btn-primary" :disabled="saving || !name">
        {{ saving ? 'Creating...' : 'Create Community' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.create-community-page {
  max-width: 600px;
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.community-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-error {
  padding: var(--space-3);
  background: var(--red-bg, var(--surface2));
  color: var(--red, var(--text));
  border: 1px solid var(--red, var(--border));
  font-size: var(--text-sm);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.form-input,
.form-textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-base);
  font-family: var(--font-sans);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.form-textarea {
  resize: vertical;
}

.cpub-btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  cursor: pointer;
  align-self: flex-start;
}

.cpub-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
