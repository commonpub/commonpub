<script setup lang="ts">
interface Option {
  text: string;
  correct: boolean;
}

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ answered: [correct: boolean] }>();

const question = computed(() => (props.content.question as string) || '');
const options = computed<Option[]>(() => {
  const raw = props.content.options;
  if (!Array.isArray(raw)) return [];
  return raw as Option[];
});

const selectedIndex = ref<number | null>(null);
const answered = ref(false);

const isCorrect = computed(() => {
  if (selectedIndex.value === null) return false;
  return options.value[selectedIndex.value]?.correct ?? false;
});

function selectOption(idx: number): void {
  if (answered.value) return;
  selectedIndex.value = idx;
  answered.value = true;
  emit('answered', isCorrect.value);
}

const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function optionClass(idx: number): string {
  if (!answered.value) return '';
  if (idx === selectedIndex.value && isCorrect.value) return 'selected-correct answered';
  if (idx === selectedIndex.value && !isCorrect.value) return 'selected-wrong answered';
  if (options.value[idx]?.correct) return 'reveal-correct answered';
  return 'answered';
}
</script>

<template>
  <div class="cpub-block-quiz">
    <div class="cpub-quiz-header">
      <span class="cpub-quiz-badge">QUIZ</span>
      <span class="cpub-quiz-title-text">Knowledge Check</span>
    </div>

    <div class="cpub-quiz-body">
      <div class="cpub-quiz-question">{{ question }}</div>

      <div class="cpub-quiz-options" role="radiogroup" :aria-label="question">
        <button
          v-for="(opt, i) in options"
          :key="i"
          class="cpub-quiz-option"
          :class="optionClass(i)"
          role="radio"
          :aria-checked="selectedIndex === i"
          :aria-disabled="answered"
          @click="selectOption(i)"
        >
          <span class="cpub-quiz-option-key">{{ optionKeys[i] || i + 1 }}</span>
          <span class="cpub-quiz-option-text">{{ opt.text }}</span>
          <span class="cpub-quiz-option-indicator">
            <template v-if="answered && i === selectedIndex && isCorrect">
              <i class="fa-solid fa-check"></i>
            </template>
            <template v-else-if="answered && i === selectedIndex && !isCorrect">
              <i class="fa-solid fa-xmark"></i>
            </template>
            <template v-else-if="answered && opt.correct">
              <i class="fa-solid fa-check"></i>
            </template>
          </span>
        </button>
      </div>

      <div v-if="answered" class="cpub-quiz-feedback" :class="isCorrect ? 'correct' : 'wrong'">
        <i :class="isCorrect ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'"></i>
        <span>{{ isCorrect ? 'Correct!' : 'Not quite — the correct answer is highlighted above.' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-quiz {
  background: var(--surface);
  border: 2px solid var(--border);
  margin: 28px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-quiz-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 2px solid var(--border);
}

.cpub-quiz-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--yellow);
  background: var(--yellow-bg);
  border: 2px solid var(--yellow-border);
  padding: 3px 8px;
}

.cpub-quiz-title-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.cpub-quiz-body { padding: 16px 20px; }

.cpub-quiz-question {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
  margin-bottom: 16px;
}

.cpub-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-quiz-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
  user-select: none;
  text-align: left;
  width: 100%;
  font-family: inherit;
  font-size: inherit;
}

.cpub-quiz-option:hover:not(.answered) {
  background: var(--surface2);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-quiz-option.selected-correct {
  background: var(--green-bg);
  border-color: var(--green);
  cursor: default;
}

.cpub-quiz-option.selected-wrong {
  background: var(--red-bg);
  border-color: var(--red);
  cursor: default;
}

.cpub-quiz-option.reveal-correct {
  background: var(--green-bg);
  border-color: var(--green-border);
  cursor: default;
}

.cpub-quiz-option.answered { cursor: default; box-shadow: none; }

.cpub-quiz-option-key {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
  width: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-key { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-key { color: var(--red); }
.cpub-quiz-option.reveal-correct .cpub-quiz-option-key { color: var(--green); }

.cpub-quiz-option-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-dim);
  flex: 1;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-text { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-text { color: var(--red); }

.cpub-quiz-option-indicator {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-indicator,
.cpub-quiz-option.selected-wrong .cpub-quiz-option-indicator,
.cpub-quiz-option.reveal-correct .cpub-quiz-option-indicator {
  opacity: 1;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-indicator { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-indicator { color: var(--red); }
.cpub-quiz-option.reveal-correct .cpub-quiz-option-indicator { color: var(--green); }

.cpub-quiz-feedback {
  margin-top: 14px;
  padding: 10px 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-quiz-feedback.correct {
  background: var(--green-bg);
  border: 2px solid var(--green-border);
  color: var(--green);
}

.cpub-quiz-feedback.wrong {
  background: var(--red-bg);
  border: 2px solid var(--red-border);
  color: var(--red);
}
</style>
