<script setup lang="ts">
/**
 * Starter form shown when creating new content.
 * Collects title, description, and cover image before entering the editor.
 * Creates a draft on submit so autosave works immediately.
 */
const props = defineProps<{
  contentType: string;
  /** v-model for title */
  title: string;
  /** v-model for metadata */
  metadata: Record<string, unknown>;
  saving: boolean;
  error: string;
}>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:metadata': [value: Record<string, unknown>];
  submit: [];
}>();

function updateField(key: string, value: unknown): void {
  emit('update:metadata', { ...props.metadata, [key]: value });
}
</script>

<template>
  <div class="cpub-starter-overlay">
    <div class="cpub-starter-card">
      <div class="cpub-starter-header">
        <NuxtLink to="/create" class="cpub-starter-back">
          <i class="fa-solid fa-arrow-left" /> Back
        </NuxtLink>
        <h1 class="cpub-starter-title">New {{ contentType }}</h1>
        <p class="cpub-starter-subtitle">Fill in the basics to get started. You can change these later.</p>
      </div>

      <div v-if="error" class="cpub-starter-error" role="alert">{{ error }}</div>

      <form class="cpub-starter-form" @submit.prevent="emit('submit')">
        <div class="cpub-starter-field">
          <label for="starter-title" class="cpub-starter-label">
            Title <span class="cpub-starter-required">*</span>
          </label>
          <input
            id="starter-title"
            :value="title"
            @input="emit('update:title', ($event.target as HTMLInputElement).value)"
            type="text"
            class="cpub-starter-input"
            :placeholder="`My awesome ${contentType}...`"
            required
            autofocus
          />
        </div>

        <div class="cpub-starter-field">
          <label for="starter-desc" class="cpub-starter-label">Description</label>
          <textarea
            id="starter-desc"
            :value="(metadata.description as string) || ''"
            @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
            class="cpub-starter-input cpub-starter-textarea"
            rows="3"
            placeholder="A brief summary of what this is about..."
          />
        </div>

        <div class="cpub-starter-field">
          <label class="cpub-starter-label">Cover Image</label>
          <ImageUpload
            :model-value="(metadata.coverImageUrl as string) || ''"
            @update:model-value="updateField('coverImageUrl', $event)"
            purpose="cover"
            hint="Recommended: 1200×630px or wider"
          />
        </div>

        <div class="cpub-starter-actions">
          <button type="submit" class="cpub-starter-submit" :disabled="saving || !title.trim()">
            {{ saving ? 'Creating...' : 'Start Writing' }}
          </button>
          <NuxtLink to="/create" class="cpub-starter-cancel">Cancel</NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.cpub-starter-overlay {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 24px 64px;
}

.cpub-starter-card { width: 100%; max-width: 560px; }
.cpub-starter-header { margin-bottom: 28px; }

.cpub-starter-back {
  font-size: 0.8125rem;
  color: var(--text-dim);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}
.cpub-starter-back:hover { color: var(--text); }

.cpub-starter-title {
  font-family: var(--font-display, var(--font-sans));
  font-size: 1.75rem;
  font-weight: 800;
  margin-bottom: 6px;
  text-transform: capitalize;
}

.cpub-starter-subtitle { font-size: 0.9375rem; color: var(--text-dim); }

.cpub-starter-error {
  padding: 10px 14px;
  background: var(--red-bg);
  color: var(--red);
  border: 2px solid var(--red);
  font-size: 0.8125rem;
  margin-bottom: 16px;
}

.cpub-starter-form { display: flex; flex-direction: column; gap: 20px; }
.cpub-starter-field { display: flex; flex-direction: column; gap: 6px; }

.cpub-starter-label {
  font-family: var(--font-mono, monospace);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.cpub-starter-required { color: var(--red); }

.cpub-starter-input {
  padding: 10px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}
.cpub-starter-input:focus { border-color: var(--accent); }
.cpub-starter-input::placeholder { color: var(--text-faint); }
.cpub-starter-textarea { resize: vertical; min-height: 60px; line-height: 1.5; }

.cpub-starter-actions {
  display: flex;
  gap: 12px;
  padding-top: 8px;
}

.cpub-starter-submit {
  padding: 10px 24px;
  background: var(--accent);
  color: var(--color-text-inverse, #fff);
  border: 2px solid var(--border);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow 0.1s;
}
.cpub-starter-submit:hover { box-shadow: 2px 2px 0 var(--border); }
.cpub-starter-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.cpub-starter-cancel {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  background: transparent;
  border: 2px solid var(--border);
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}
.cpub-starter-cancel:hover { background: var(--surface2); }
</style>
