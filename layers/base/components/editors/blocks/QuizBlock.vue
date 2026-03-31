<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();
interface Option { text: string; correct: boolean; }
const question = computed(() => (props.content.question as string) ?? '');
const options = computed(() => (props.content.options as Option[]) ?? []);
function updateQuestion(value: string): void { emit('update', { ...props.content, question: value }); }
function addOption(): void { emit('update', { ...props.content, options: [...options.value, { text: '', correct: false }] }); }
function updateOption(i: number, field: string, value: unknown): void {
  const updated = [...options.value];
  updated[i] = { ...updated[i]!, [field]: value };
  emit('update', { ...props.content, options: updated });
}
function removeOption(i: number): void {
  emit('update', { ...props.content, options: options.value.filter((_: Option, idx: number) => idx !== i) });
}
</script>
<template>
  <div class="cpub-quiz-block">
    <div class="cpub-quiz-header"><i class="fa-solid fa-circle-question"></i> Quiz</div>
    <div class="cpub-quiz-body">
      <input class="cpub-quiz-question" type="text" :value="question" placeholder="Ask a question..." @input="updateQuestion(($event.target as HTMLInputElement).value)" />
      <div v-for="(opt, i) in options" :key="i" class="cpub-quiz-option">
        <input type="checkbox" :checked="opt.correct" @change="updateOption(i, 'correct', ($event.target as HTMLInputElement).checked)" />
        <input class="cpub-quiz-opt-text" type="text" :value="opt.text" placeholder="Option text..." @input="updateOption(i, 'text', ($event.target as HTMLInputElement).value)" />
        <button class="cpub-quiz-opt-remove" @click="removeOption(i)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <button class="cpub-quiz-add-opt" @click="addOption"><i class="fa-solid fa-plus"></i> Add option</button>
    </div>
  </div>
</template>
<style scoped>
.cpub-quiz-block { border: 2px solid var(--border2); background: var(--surface); }
.cpub-quiz-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: 2px solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-quiz-header i { color: var(--purple); }
.cpub-quiz-body { padding: 12px; }
.cpub-quiz-question { width: 100%; font-size: 14px; font-weight: 600; background: transparent; border: none; border-bottom: 2px solid var(--border2); padding: 6px 0; outline: none; color: var(--text); margin-bottom: 12px; }
.cpub-quiz-question::placeholder { color: var(--text-faint); }
.cpub-quiz-option { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.cpub-quiz-option input[type="checkbox"] { accent-color: var(--green); }
.cpub-quiz-opt-text { flex: 1; font-size: 12px; background: transparent; border: none; outline: none; color: var(--text); padding: 4px; }
.cpub-quiz-opt-text::placeholder { color: var(--text-faint); }
.cpub-quiz-opt-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; }
.cpub-quiz-opt-remove:hover { color: var(--red); }
.cpub-quiz-add-opt { margin-top: 8px; font-size: 11px; color: var(--text-dim); background: none; border: 2px dashed var(--border2); padding: 6px 12px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; }
.cpub-quiz-add-opt:hover { border-color: var(--accent); color: var(--accent); }
</style>
