<script setup lang="ts">
/**
 * Visibility radio group for editor panels.
 * Reused across Article, Project, Explainer editors.
 */
defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const options = [
  { value: 'public', label: 'Public', icon: 'fa-globe', desc: 'Visible to everyone' },
  { value: 'members', label: 'Members', icon: 'fa-users', desc: 'Hub members only' },
  { value: 'private', label: 'Private', icon: 'fa-lock', desc: 'Only you' },
];
</script>

<template>
  <div class="cpub-visibility-group" role="radiogroup" aria-label="Content visibility">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="cpub-visibility-option"
      :class="{ selected: modelValue === opt.value }"
    >
      <input
        type="radio"
        :value="opt.value"
        :checked="modelValue === opt.value"
        class="cpub-sr-only"
        @change="emit('update:modelValue', opt.value)"
      />
      <i :class="['fa-solid', opt.icon, 'cpub-vis-icon']"></i>
      <div class="cpub-vis-text">
        <span class="cpub-vis-label">{{ opt.label }}</span>
        <span class="cpub-vis-desc">{{ opt.desc }}</span>
      </div>
    </label>
  </div>
</template>

<style scoped>
.cpub-visibility-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-visibility-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 2px solid var(--border2);
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}

.cpub-visibility-option:hover {
  border-color: var(--border);
  background: var(--surface2);
}

.cpub-visibility-option.selected {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-vis-icon {
  font-size: 12px;
  color: var(--text-faint);
  width: 16px;
  text-align: center;
}

.cpub-visibility-option.selected .cpub-vis-icon {
  color: var(--accent);
}

.cpub-vis-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cpub-vis-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.cpub-vis-desc {
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
