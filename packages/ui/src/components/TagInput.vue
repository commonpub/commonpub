<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ name: 'CpubTagInput' });

interface Props {
  modelValue?: string[];
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  placeholder: 'Type and press Enter',
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

function addTag(): void {
  const tag = inputValue.value.trim();
  if (tag && !props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag]);
  }
  inputValue.value = '';
}

function removeTag(index: number): void {
  const newTags = [...props.modelValue];
  newTags.splice(index, 1);
  emit('update:modelValue', newTags);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTag();
  } else if (event.key === 'Backspace' && !inputValue.value && props.modelValue.length > 0) {
    removeTag(props.modelValue.length - 1);
  }
}

function focusInput(): void {
  inputRef.value?.focus();
}
</script>

<template>
  <div
    class="cpub-tag-input"
    @click="focusInput"
  >
    <span
      v-for="(tag, index) in props.modelValue"
      :key="tag"
      class="cpub-tag-input__tag"
    >
      {{ tag }}
      <button
        type="button"
        class="cpub-tag-input__remove"
        :aria-label="`Remove ${tag}`"
        @click.stop="removeTag(index)"
      >
        &#10005;
      </button>
    </span>
    <input
      ref="inputRef"
      v-model="inputValue"
      class="cpub-tag-input__input"
      :placeholder="props.modelValue.length === 0 ? props.placeholder : ''"
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.cpub-tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  cursor: text;
  min-height: 2.5rem;
  align-items: center;
  transition: box-shadow var(--transition-fast);
}

.cpub-tag-input:focus-within {
  box-shadow: var(--shadow-accent);
}

.cpub-tag-input__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background-color: var(--surface3);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius);
  line-height: 1;
}

.cpub-tag-input__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  font-size: var(--text-xs);
  padding: 0;
  width: 1rem;
  height: 1rem;
}

.cpub-tag-input__remove:hover {
  color: var(--red);
}

.cpub-tag-input__remove:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-tag-input__input {
  flex: 1;
  min-width: 4rem;
  border: none;
  background: none;
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text);
  outline: none;
  padding: 0;
}

.cpub-tag-input__input::placeholder {
  color: var(--text-faint);
}
</style>
