import { isSafeUrl } from '@commonpub/explainer';

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

/** Attributes whose value is a URL and must therefore be scheme-checked, not just allow-listed. */
const URL_ATTRS = new Set(['href', 'src']);

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Strip script/style elements with their contents, and inline event handlers.
  // Note the `on*` strip runs BEFORE the attribute allow-list so a handler on an
  // otherwise-allowed tag is gone regardless of quoting.
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip disallowed tags but keep content
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) {
      // Strip disallowed attributes from allowed tags, and drop any URL-bearing
      // attribute whose scheme is not on the allowlist.
      return match.replace(
        /\s([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        (attrMatch, attr: string, dq?: string, sq?: string, uq?: string) => {
          const name = attr.toLowerCase();
          if (!ALLOWED_ATTRS.has(name)) return '';
          if (URL_ATTRS.has(name)) {
            const value = dq ?? sq ?? uq ?? '';
            if (!isSafeUrl(value)) return '';
          }
          return attrMatch;
        },
      );
    }
    return '';
  });

  return clean;
}
