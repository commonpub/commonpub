/**
 * Client-side HTML sanitizer for v-html bindings.
 *
 * Defense-in-depth: content is also sanitized server-side at ingest
 * (protocol/sanitize.ts for federated content, TipTap for local content).
 * This provides a second barrier in case of any server-side bypass.
 *
 * Mirrors the allowlist from @commonpub/protocol/sanitize.ts.
 */

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

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'title', 'class']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'class']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start', 'type']),
  code: new Set(['class']),
  span: new Set(['class']),
  pre: new Set(['class']),
  blockquote: new Set(['class']),
  p: new Set(['class']),
};

const SAFE_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);
const DANGEROUS_URL_PATTERNS = [/^javascript:/i, /^vbscript:/i, /^blob:/i];
const SAFE_DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i;

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  for (const pattern of DANGEROUS_URL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  if (/^data:/i.test(trimmed)) {
    return SAFE_DATA_URI_PATTERN.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    if (!SAFE_URL_SCHEMES.has(parsed.protocol)) return false;
  } catch {
    // Relative URLs are fine
  }
  return true;
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Sanitize HTML for safe rendering via v-html */
export function sanitizeBlockHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let result = html;

  // Strip HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Process all HTML tags
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g, (match, tagName, attrs) => {
    const tag = (tagName as string).toLowerCase();

    if (!ALLOWED_ELEMENTS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;

    const allowedAttrs = ALLOWED_ATTRIBUTES[tag];
    if (!attrs || !allowedAttrs) {
      const selfClose = match.endsWith('/>') ? ' /' : '';
      return `<${tag}${selfClose}>`;
    }

    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(attrs as string)) !== null) {
      const attrName = attrMatch[1]!.toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      if (attrName.startsWith('on')) continue;
      if (attrName === 'style') continue;
      if (!allowedAttrs.has(attrName)) continue;

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

/** Composable wrapper for template use */
export function useSanitize(): { sanitize: (html: string) => string } {
  return { sanitize: sanitizeBlockHtml };
}
