<script setup lang="ts">
/**
 * Build step block — numbered step with title and instruction text.
 */
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const stepNumber = computed(() => (props.content.stepNumber as number) ?? 1);
const title = computed(() => (props.content.title as string) ?? '');
const instructions = computed(() => (props.content.instructions as string) ?? '');
const time = computed(() => (props.content.time as string) ?? '');

function updateField(field: string, value: unknown): void {
  emit('update', { ...props.content, [field]: value });
}
</script>

<template>
  <div class="cpub-step-block">
    <div class="cpub-step-header">
      <div class="cpub-step-num">{{ stepNumber }}</div>
      <input
        class="cpub-step-title"
        type="text"
        :value="title"
        placeholder="Step title..."
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
      />
      <input
        class="cpub-step-time"
        type="text"
        :value="time"
        placeholder="Time"
        @input="updateField('time', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="cpub-step-body">
      <textarea
        class="cpub-step-instructions"
        :value="instructions"
        placeholder="Describe this step..."
        rows="4"
        @input="updateField('instructions', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.cpub-step-block { border: 2px solid var(--border2); background: var(--surface); }

.cpub-step-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: 2px solid var(--border2);
  background: var(--surface2);
}

.cpub-step-num {
  width: 32px; height: 32px;
  background: var(--accent); color: var(--color-text-inverse);
  font-family: var(--font-mono); font-size: 14px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.cpub-step-title {
  flex: 1; font-size: 14px; font-weight: 600;
  background: transparent; border: none; outline: none;
  color: var(--text);
}
.cpub-step-title::placeholder { color: var(--text-faint); }

.cpub-step-time {
  width: 80px; font-family: var(--font-mono); font-size: 10px;
  background: transparent; border: 2px solid var(--border2);
  padding: 3px 6px; color: var(--text-dim); outline: none;
  text-align: center;
}
.cpub-step-time:focus { border-color: var(--accent); }
.cpub-step-time::placeholder { color: var(--text-faint); }

.cpub-step-body { padding: 14px 16px; }

.cpub-step-instructions {
  width: 100%; font-size: 13px; line-height: 1.65;
  background: transparent; border: none; outline: none;
  color: var(--text); resize: vertical;
  font-family: var(--font-sans, system-ui);
}
.cpub-step-instructions::placeholder { color: var(--text-faint); }
</style>
