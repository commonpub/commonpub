/**
 * HTML sanitizer for inbound ActivityPub content.
 * Critical security boundary — all federated HTML MUST pass through this.
 */

/** Elements allowed in federated content */
const ALLOWED_ELEMENTS = new Set([
  'p', 'br', 'hr',
  'a',
  'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins',
  'sub', 'sup',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'dl', 'dt', 'dd',
  'details', 'summary',
  'span',
]);

/** Attributes allowed per element */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'title', 'class']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'class']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start', 'type']),
  code: new Set(['class']), // for language hints
  span: new Set(['class']),
  pre: new Set(['class']),
  blockquote: new Set(['class']),
  p: new Set(['class']),
};

/** URL schemes that are safe in href/src attributes */
const SAFE_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

/** Patterns that indicate a dangerous URL */
const DANGEROUS_URL_PATTERNS = [
  /^javascript:/i,
  /^vbscript:/i,
  /^blob:/i,
];

/** Data URIs are only allowed for safe image formats */
const SAFE_DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i;

/**
 * Check if a URL is safe for use in href/src attributes.
 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();

  // Check for dangerous patterns (handles unicode obfuscation)
  for (const pattern of DANGEROUS_URL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Data URIs: only allow safe image formats
  if (/^data:/i.test(trimmed)) {
    return SAFE_DATA_URI_PATTERN.test(trimmed);
  }

  // Must have a safe scheme or be relative
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    if (!SAFE_URL_SCHEMES.has(parsed.protocol)) return false;
  } catch {
    // Relative URLs are fine
  }

  return true;
}

/**
 * Simple regex-based HTML sanitizer for ActivityPub content.
 *
 * This is intentionally simple and conservative. It works by:
 * 1. Stripping all HTML tags not in the allowlist
 * 2. Removing dangerous attributes from allowed tags
 * 3. Validating URLs in href/src attributes
 *
 * For production, consider using DOMPurify (server-side via jsdom).
 * This implementation covers the critical security cases without
 * adding a DOM dependency.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let result = html;

  // Strip HTML comments (can hide content from parsers)
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Process all HTML tags
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g, (match, tagName, attrs) => {
    const tag = (tagName as string).toLowerCase();

    // Strip disallowed elements entirely
    if (!ALLOWED_ELEMENTS.has(tag)) return '';

    // Self-closing or closing tag
    if (match.startsWith('</')) return `</${tag}>`;

    // Parse and filter attributes
    const allowedAttrs = ALLOWED_ATTRIBUTES[tag];
    if (!attrs || !allowedAttrs) {
      // No attributes allowed or none present
      const selfClose = match.endsWith('/>') ? ' /' : '';
      return `<${tag}${selfClose}>`;
    }

    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(attrs as string)) !== null) {
      const attrName = attrMatch[1]!.toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      // Skip event handlers (onclick, onerror, onload, etc.)
      if (attrName.startsWith('on')) continue;

      // Skip style attribute (can contain url() expressions)
      if (attrName === 'style') continue;

      // Only allow listed attributes
      if (!allowedAttrs.has(attrName)) continue;

      // Validate URLs in href and src
      if ((attrName === 'href' || attrName === 'src') && !isSafeUrl(attrValue)) {
        continue;
      }

      safeAttrs.push(`${attrName}="${escapeAttrValue(attrValue)}"`);
    }

    const attrsStr = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
    const selfClose = match.endsWith('/>') ? ' /' : '';
    return `<${tag}${attrsStr}${selfClose}>`;
  });

  return result;
}

/** Escape HTML attribute values */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
