<script setup lang="ts">
/**
 * Code block — textarea with language selector, filename, and copy button.
 * Styled to match the mockup's dark terminal aesthetic.
 */
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const code = computed(() => (props.content.code as string) ?? '');
const language = computed(() => (props.content.language as string) ?? '');
const filename = computed(() => (props.content.filename as string) ?? '');

const languages = [
  '', 'javascript', 'typescript', 'python', 'c', 'cpp', 'rust', 'go',
  'java', 'bash', 'html', 'css', 'json', 'yaml', 'sql', 'markdown',
];

const copied = ref(false);

function updateField(field: string, value: string): void {
  emit('update', { ...props.content, [field]: value });
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // clipboard API not available
  }
}
</script>

<template>
  <div class="cpub-code-block">
    <div class="cpub-code-header">
      <select
        class="cpub-code-lang"
        :value="language"
        aria-label="Programming language"
        @change="updateField('language', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="lang in languages" :key="lang" :value="lang">
          {{ lang || 'Plain text' }}
        </option>
      </select>
      <input
        class="cpub-code-filename"
        type="text"
        :value="filename"
        placeholder="filename.ext"
        aria-label="Filename"
        @input="updateField('filename', ($event.target as HTMLInputElement).value)"
      />
      <button class="cpub-code-copy" @click="copyCode">
        <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i>
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <textarea
      class="cpub-code-body"
      :value="code"
      placeholder="// Write your code here..."
      spellcheck="false"
      aria-label="Code content"
      @input="updateField('code', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
/* Dark code editor context — scoped white-on-dark tokens */
.cpub-code-block {
  --code-fg-faint: rgba(255, 255, 255, 0.2);
  --code-fg-dim: rgba(255, 255, 255, 0.5);
  --code-fg: rgba(255, 255, 255, 0.8);
  --code-border: rgba(255, 255, 255, 0.15);
  --code-surface: rgba(255, 255, 255, 0.08);
  --code-surface-dim: rgba(255, 255, 255, 0.04);

  background: var(--text);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
}

.cpub-code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--code-surface-dim);
  border-bottom: var(--border-width-default) solid var(--code-surface);
}

.cpub-code-lang {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  padding: 2px 4px;
}

.cpub-code-lang option {
  background: var(--text);
  color: var(--surface);
}

.cpub-code-filename {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  background: transparent;
  border: none;
  outline: none;
  flex: 1;
  padding: 2px 4px;
}

.cpub-code-filename::placeholder {
  color: var(--code-fg-faint);
}

.cpub-code-copy {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--code-fg-dim);
  background: transparent;
  border: var(--border-width-default) solid var(--code-border);
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition: all 0.1s;
}

.cpub-code-copy:hover {
  color: var(--code-fg);
  background: var(--code-surface);
}

.cpub-code-body {
  width: 100%;
  min-height: 120px;
  padding: 14px 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--surface);
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
  tab-size: 2;
  white-space: pre;
  overflow-x: auto;
}

.cpub-code-body::placeholder {
  color: var(--code-fg-faint);
}
</style>
