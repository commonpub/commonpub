<script setup lang="ts">
import QuizBlock from '../vue/components/blocks/QuizBlock.vue';

function logAnswer(correct: boolean) {
  console.log('Answer:', correct ? 'correct' : 'wrong');
}
</script>

<template>
  <Story title="Blocks/QuizBlock" group="blocks">
    <Variant title="Basic Quiz">
      <QuizBlock
        :content="{
          question: 'What is the time complexity of binary search?',
          options: [
            { text: 'O(n)', correct: false },
            { text: 'O(log n)', correct: true },
            { text: 'O(n²)', correct: false },
            { text: 'O(1)', correct: false },
          ],
        }"
        @answered="logAnswer"
      />
    </Variant>

    <Variant title="Two Options">
      <QuizBlock
        :content="{
          question: 'Is TypeScript a superset of JavaScript?',
          options: [
            { text: 'Yes', correct: true },
            { text: 'No', correct: false },
          ],
        }"
        @answered="logAnswer"
      />
    </Variant>

    <Variant title="Long Options">
      <QuizBlock
        :content="{
          question: 'Which of the following best describes the purpose of a hash table?',
          options: [
            { text: 'A data structure that stores elements in a sorted order and allows O(log n) lookups', correct: false },
            { text: 'A data structure that maps keys to values using a hash function for O(1) average-case lookups', correct: true },
            { text: 'A tree-based structure that maintains balance through rotations after insertions', correct: false },
            { text: 'A linked list variant that allows bidirectional traversal of elements', correct: false },
          ],
        }"
        @answered="logAnswer"
      />
    </Variant>
  </Story>
</template>
