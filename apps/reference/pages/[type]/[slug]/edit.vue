<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);
const isNew = computed(() => slug.value === 'new');

useSeoMeta({
  title: () => isNew.value ? `New ${contentType.value} — CommonPub` : `Edit — CommonPub`,
});

const { user } = useAuth();

const title = ref('');
const description = ref('');
const saving = ref(false);
const error = ref('');

// Load existing content for editing
if (!isNew.value) {
  const { data } = await useFetch(() => `/api/content/${slug.value}`);
  if (data.value) {
    title.value = data.value.title;
    description.value = data.value.description || '';
  }
}

async function handleSave(): Promise<void> {
  saving.value = true;
  error.value = '';

  try {
    if (isNew.value) {
      const result = await $fetch('/api/content', {
        method: 'POST',
        body: {
          type: contentType.value,
          title: title.value,
          description: description.value,
        },
      });
      await navigateTo(`/${contentType.value}/${(result as { slug: string }).slug}`);
    } else {
      const existing = await $fetch(`/api/content/${slug.value}`);
      await $fetch(`/api/content/${(existing as { id: string }).id}`, {
        method: 'PUT',
        body: {
          title: title.value,
          description: description.value,
        },
      });
      await navigateTo(`/${contentType.value}/${slug.value}`);
    }
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to save.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-page">
    <header class="editor-header">
      <h1 class="editor-title">{{ isNew ? `New ${contentType}` : 'Edit' }}</h1>
      <button class="cpub-save-btn" :disabled="saving || !title" @click="handleSave">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </header>

    <div v-if="error" class="editor-error" role="alert">{{ error }}</div>

    <div class="editor-form">
      <div class="editor-field">
        <label for="edit-title" class="editor-label">Title</label>
        <input
          id="edit-title"
          v-model="title"
          type="text"
          class="editor-input"
          placeholder="Enter a title..."
          required
        />
      </div>

      <div class="editor-field">
        <label for="edit-desc" class="editor-label">Description</label>
        <textarea
          id="edit-desc"
          v-model="description"
          class="editor-textarea"
          placeholder="Brief description..."
          rows="3"
        />
      </div>

      <div class="editor-field">
        <label class="editor-label">Content</label>
        <div class="editor-placeholder">
          Full TipTap block editor will be rendered here.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  max-width: var(--content-max-width);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.editor-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  text-transform: capitalize;
}

.cpub-save-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  cursor: pointer;
}

.cpub-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.cpub-save-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.editor-error {
  padding: var(--space-3);
  background: var(--red-bg, var(--surface2));
  color: var(--red, var(--text));
  border: 1px solid var(--red, var(--border));
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.editor-label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text);
}

.editor-input {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-lg);
  font-family: var(--font-sans);
}

.editor-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.editor-textarea {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-base);
  font-family: var(--font-sans);
  resize: vertical;
}

.editor-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.editor-placeholder {
  padding: var(--space-10);
  border: 2px dashed var(--border);
  text-align: center;
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
