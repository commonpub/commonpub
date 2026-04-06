import type { Component } from 'vue';
import SliderBlock from '../blocks/SliderBlock.vue';
import QuizBlock from '../blocks/QuizBlock.vue';

/**
 * Module type → viewer component map.
 * Sprint 2: simple record. Sprint 3 will formalize to folder-based modules.
 */
export const moduleMap: Record<string, Component> = {
  slider: SliderBlock,
  quiz: QuizBlock,
};
