import type { TocEntry } from '../types.js';

/**
 * Generate a URL-safe heading ID from text.
 * Lowercase, hyphenated, deduped with suffix if needed.
 */
export function generateHeadingId(text: string, existing: Set<string> = new Set()): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!base) return 'heading';

  let id = base;
  let counter = 1;
  while (existing.has(id)) {
    id = `${base}-${counter}`;
    counter++;
  }

  return id;
}

/**
 * Extract headings (h2-h6) from markdown content.
 * Returns a list of TocEntry objects for building a table of contents.
 */
export function extractHeadings(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const usedIds = new Set<string>();

  // Construct per call: a shared module-level /g regex carries `lastIndex`
  // state across invocations, which corrupts the TOC if a prior call throws
  // mid-drain or runs re-entrantly.
  const headingRegex = /^(#{2,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    const id = generateHeadingId(text, usedIds);
    usedIds.add(id);

    entries.push({ id, text, level });
  }

  return entries;
}
