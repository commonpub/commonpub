/**
 * Strip Markdown (and the inline-HTML-ish bits we author) down to clean,
 * single-line plain text suitable for a CSS-clamped excerpt.
 *
 * Used wherever we want a short tagline/blurb from a (possibly long) Markdown
 * description without dumping a raw `## ...` / fenced-code wall into the UI —
 * the contest hero tagline and the contest listing card blurb both share this.
 * The full formatted description still renders through the Markdown pipeline
 * elsewhere; this is purely for the truncated preview.
 *
 * Returns `''` for empty/whitespace input.
 */
export function markdownToExcerpt(raw: string | null | undefined): string {
  const d = (raw ?? '').trim();
  if (!d) return '';
  return d
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
