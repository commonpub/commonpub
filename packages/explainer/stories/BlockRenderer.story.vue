<script setup lang="ts">
import BlockRenderer from '../vue/components/BlockRenderer.vue';

type BlockTuple = [string, Record<string, unknown>];

const sampleBlocks: BlockTuple[] = [
  ['sectionHeader', { tag: '§ 01', title: 'What is Binary Search?', body: 'A fundamental algorithm every developer should understand.' }],
  ['text', { html: '<p>Binary search is an efficient algorithm for finding a target value within a <strong>sorted array</strong>. Instead of checking every element, it repeatedly divides the search space in half.</p>' }],
  ['callout', { variant: 'tip', html: '<p>Binary search only works on sorted data. Always sort first!</p>' }],
  ['code', { language: 'python', code: 'def binary_search(arr, target):\n    low, high = 0, len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1' }],
  ['interactiveSlider', {
    label: 'Array Size',
    min: 10,
    max: 1000000,
    step: 10,
    unit: ' elements',
    defaultValue: 1000,
    feedback: [
      { min: 10, max: 100, state: 'low', message: 'For small arrays, linear search is fine. Binary search shines at scale.' },
      { min: 100, max: 10000, state: 'good', message: 'At this size, binary search is ~10x faster than linear search.' },
      { min: 10000, max: 1000000, state: 'ok', message: 'Binary search: ~20 comparisons. Linear: up to 1,000,000. Massive difference.' },
    ],
  }],
  ['heading', { level: 2, text: 'Time Complexity' }],
  ['text', { html: '<p>Each step eliminates half the remaining elements. For an array of <em>n</em> elements, the maximum number of steps is log₂(n).</p>' }],
  ['quiz', {
    question: 'How many comparisons does binary search need for an array of 1,024 elements?',
    options: [
      { text: '10', correct: true },
      { text: '512', correct: false },
      { text: '1024', correct: false },
      { text: '32', correct: false },
    ],
  }],
  ['checkpoint', { label: 'You understand the fundamentals of binary search' }],
];

function onQuiz(idx: number, correct: boolean) {
  console.log(`Block ${idx}: ${correct ? 'correct' : 'wrong'}`);
}
</script>

<template>
  <Story title="Composites/BlockRenderer" group="composites">
    <Variant title="Mixed Content">
      <div style="max-width: 720px; margin: 0 auto; padding: 24px;">
        <BlockRenderer
          :blocks="sampleBlocks"
          @quiz-answered="onQuiz"
          @checkpoint-reached="(idx) => console.log('Checkpoint at', idx)"
        />
      </div>
    </Variant>
  </Story>
</template>
