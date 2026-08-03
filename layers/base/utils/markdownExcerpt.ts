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
    // Strip embedded HTML FIRST — a Markdown import can leave a `<!-- ==== -->`
    // header, a `<style>…</style>` block (CSS), or other raw tags at the top of
    // the description, which would otherwise surface as raw `<!--` / `<style> .rac{…`
    // text in a plain-text excerpt (hero tagline, homepage banner, listing card).
    // 1) comments (terminated or trailing-unterminated).
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    // 2) style/script/template blocks WITH their contents (the CSS/JS text must go,
    //    not just the tags). Handles an unterminated block by dropping to end.
    .replace(/<(style|script|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // 3) any remaining HTML tags — keep their text content, drop the markup.
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    // 4) decode the handful of common HTML entities so they don't show literally.
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/gi, (m) =>
      ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" }[m.toLowerCase()] ?? ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
