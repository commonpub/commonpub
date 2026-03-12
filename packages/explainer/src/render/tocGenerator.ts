import type { ExplainerSection, ExplainerProgressState, TocItem } from '../types.js';
import { canAccessSection } from '../progress/tracker.js';

/** Generate table of contents data from sections and progress state */
export function generateToc(
  sections: ExplainerSection[],
  progress: ExplainerProgressState,
  activeSectionId?: string,
): TocItem[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    anchor: section.anchor,
    completed: progress.sections[section.id]?.completed ?? false,
    active: section.id === activeSectionId,
    locked: !canAccessSection(progress, sections, section.id),
  }));
}
