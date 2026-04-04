import { ref, computed, type Ref } from 'vue';

/**
 * Reactive progress tracking for explainer sections.
 * Tracks which sections are completed and provides navigation helpers.
 */
export function useExplainerProgress(totalSections: Ref<number>) {
  const activeSection = ref(0);
  const completedSections = ref<Set<number>>(new Set());

  const progressPct = computed(() =>
    totalSections.value > 0
      ? ((activeSection.value + 1) / totalSections.value) * 100
      : 0,
  );

  const isComplete = computed(() =>
    completedSections.value.size >= totalSections.value,
  );

  function goToSection(idx: number): void {
    if (idx >= 0 && idx < totalSections.value && idx !== activeSection.value) {
      if (activeSection.value < idx) {
        completedSections.value.add(activeSection.value);
      }
      activeSection.value = idx;
    }
  }

  function prevSection(): void {
    if (activeSection.value > 0) activeSection.value--;
  }

  function nextSection(): void {
    completedSections.value.add(activeSection.value);
    if (activeSection.value < totalSections.value - 1) activeSection.value++;
  }

  function markComplete(sectionIndex: number): void {
    completedSections.value.add(sectionIndex);
  }

  return {
    activeSection,
    completedSections,
    progressPct,
    isComplete,
    goToSection,
    prevSection,
    nextSection,
    markComplete,
  };
}
