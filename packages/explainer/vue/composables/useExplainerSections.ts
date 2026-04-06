import { computed, type Ref } from 'vue';
import { deriveSections, computeSectionRanges, type DerivedSection, type SectionRange } from '@commonpub/explainer';

type BlockTuple = [string, Record<string, unknown>];

/**
 * Reactive wrapper around section derivation.
 * Automatically recomputes sections and ranges when blocks change.
 */
export function useExplainerSections(
  blocks: Ref<BlockTuple[]>,
  fallbackTitle?: string,
) {
  const sections = computed<DerivedSection[]>(() =>
    deriveSections(blocks.value, fallbackTitle),
  );

  const ranges = computed<SectionRange[]>(() =>
    computeSectionRanges(sections.value, blocks.value.length),
  );

  return { sections, ranges };
}
