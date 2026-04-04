/**
 * Derive sections from a flat BlockTuple[] array.
 *
 * Scans for `sectionHeader` blocks, falling back to H2 headings,
 * then a single-section fallback. This is the bridge between the
 * editor's flat block model and the viewer's section-based presentation.
 */

import type { BlockTuple } from '@commonpub/editor';

/** A section derived from the block array */
export interface DerivedSection {
  title: string;
  tag: string;
  body: string;
  blockIndex: number;
}

/** Block index range for a section's body content */
export interface SectionRange {
  start: number;
  end: number;
}

/**
 * Derive sections from blocks by scanning for sectionHeader blocks.
 * Falls back to H2 headings, then a single-section wrapping all content.
 */
export function deriveSections(
  blocks: BlockTuple[],
  fallbackTitle?: string,
): DerivedSection[] {
  const result: DerivedSection[] = [];

  // First try sectionHeader blocks
  for (let i = 0; i < blocks.length; i++) {
    const [type, data] = blocks[i]!;
    if (type === 'sectionHeader') {
      result.push({
        title: (data.title as string) || 'Untitled',
        tag: (data.tag as string) || '',
        body: (data.body as string) || '',
        blockIndex: i,
      });
    }
  }

  // Fallback to H2 headings if no sectionHeader blocks
  if (result.length === 0) {
    for (let i = 0; i < blocks.length; i++) {
      const [type, data] = blocks[i]!;
      if (type === 'heading' && ((data.level as number) ?? 2) <= 2) {
        result.push({
          title: (data.text as string) || 'Untitled',
          tag: `§ ${String(result.length + 1).padStart(2, '0')}`,
          body: '',
          blockIndex: i,
        });
      }
    }
  }

  // Final fallback: treat entire content as one section
  if (result.length === 0 && blocks.length > 0) {
    result.push({
      title: fallbackTitle || 'Content',
      tag: '§ 01',
      body: '',
      blockIndex: -1,
    });
  }

  return result;
}

/**
 * Compute block ranges for each section.
 * Each range starts after the section's header block and ends at the next section header.
 */
export function computeSectionRanges(
  sections: DerivedSection[],
  totalBlocks: number,
): SectionRange[] {
  const ranges: SectionRange[] = [];

  for (let i = 0; i < sections.length; i++) {
    const start = sections[i]!.blockIndex + 1;
    const nextSec = sections[i + 1];
    const end = nextSec?.blockIndex ?? totalBlocks;
    ranges.push({ start, end });
  }

  if (ranges.length === 0 && totalBlocks > 0) {
    ranges.push({ start: 0, end: totalBlocks });
  }

  return ranges;
}
