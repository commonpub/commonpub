/**
 * HTML sanitizer for v-html bindings.
 *
 * Strips dangerous tags/attributes while preserving safe formatting.
 * In production, content should be sanitized at ingest — this is a
 * defense-in-depth layer for rendering.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'a', 'code', 'pre', 'span', 'div',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'hr', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'mark', 'small',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'title', 'class',
  'id', 'width', 'height', 'loading',
]);

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Strip script tags and event handlers
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');

  // Strip disallowed tags but keep content
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) {
      // Strip disallowed attributes from allowed tags
      return match.replace(/\s([a-z][a-z0-9-]*)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attrMatch, attr: string) => {
        return ALLOWED_ATTRS.has(attr.toLowerCase()) ? attrMatch : '';
      });
    }
    return '';
  });

  return clean;
}
