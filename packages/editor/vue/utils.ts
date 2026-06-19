/**
 * HTML sanitization for v-html bindings in block editor components.
 *
 * Block components (CalloutBlock, QuoteBlock) read `innerHTML` straight off a
 * contenteditable element and emit it back into block data. That raw HTML can
 * contain anything a paste or a crafted DOM injects, so it MUST be sanitized
 * before it is stored and later re-rendered via `v-html`.
 *
 * This is an allowlist-based sanitizer (mirroring `@commonpub/protocol`'s
 * inbound sanitizer): only safe inline-formatting elements survive, dangerous
 * elements (`<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`) and their
 * contents are dropped, `on*` event-handler attributes are stripped, and
 * `javascript:`/`vbscript:`/`data:` (non-image) URLs are neutralized.
 *
 * It prefers the browser `DOMParser` when running in a window context and falls
 * back to a conservative regex pass for SSR.
 */

/** Elements allowed in editable block HTML (inline formatting + lists). */
const ALLOWED_ELEMENTS = new Set<string>([
  'p', 'br',
  'a',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins',
  'sub', 'sup',
  'span',
]);

/** Elements whose entire subtree must be removed, not just unwrapped. */
const STRIP_WITH_CONTENT = new Set<string>([
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript',
]);

/** Attributes allowed per element. Everything else is dropped. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'title']),
  span: new Set(['class']),
  code: new Set(['class']),
  pre: new Set(['class']),
};

/** URL schemes that are safe in href attributes. */
const SAFE_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

/** Patterns that indicate a dangerous URL. */
const DANGEROUS_URL_PATTERNS: RegExp[] = [
  /^javascript:/i,
  /^vbscript:/i,
  /^blob:/i,
];

/** Data URIs are only permitted for safe raster image formats. */
const SAFE_DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

/** Check whether a URL is safe for use in an href attribute. */
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
    // Relative URLs are acceptable.
  }

  return true;
}

/** Sanitize a single element node in place (DOMParser path). */
function sanitizeElement(el: Element): void {
  const tag = el.tagName.toLowerCase();

  // Drop dangerous subtrees entirely.
  if (STRIP_WITH_CONTENT.has(tag)) {
    el.remove();
    return;
  }

  // Unwrap disallowed elements: keep their (already-sanitized) children.
  if (!ALLOWED_ELEMENTS.has(tag)) {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    } else {
      el.remove();
    }
    return;
  }

  const allowed = ALLOWED_ATTRIBUTES[tag];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();

    if (name.startsWith('on') || name === 'style' || !allowed || !allowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }

    if (name === 'href' && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }
}

/** Recursively sanitize a node's element children (depth-first). */
function walk(node: Node): void {
  // Snapshot children before mutating: sanitizeElement may unwrap/remove nodes.
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      walk(child); // sanitize descendants first
      sanitizeElement(child as Element);
    }
  }
}

/** Escape HTML attribute values for the regex fallback. */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Conservative regex-based sanitizer used when no DOM is available (SSR). */
function sanitizeWithRegex(html: string): string {
  let result = html;

  // Drop HTML comments.
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Drop dangerous elements together with their contents.
  for (const tag of STRIP_WITH_CONTENT) {
    result = result.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    // Also drop self-closing / unterminated openers.
    result = result.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // Process remaining tags against the allowlist.
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g, (match, rawName: string, rawAttrs?: string) => {
    const tag = rawName.toLowerCase();

    if (!ALLOWED_ELEMENTS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;

    const selfClose = match.endsWith('/>') ? ' /' : '';
    const allowed = ALLOWED_ATTRIBUTES[tag];
    if (!rawAttrs || !allowed) return `<${tag}${selfClose}>`;

    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const name = attrMatch[1]!.toLowerCase();
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      if (name.startsWith('on') || name === 'style' || !allowed.has(name)) continue;
      if (name === 'href' && !isSafeUrl(value)) continue;

      safeAttrs.push(`${name}="${escapeAttrValue(value)}"`);
    }

    const attrsStr = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
    return `<${tag}${attrsStr}${selfClose}>`;
  });

  return result;
}

/**
 * Sanitize HTML emitted from contenteditable block editors before it is stored
 * or bound via `v-html`. Allowlist-based: see module docstring for details.
 */
export function sanitizeBlockHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const doc = new window.DOMParser().parseFromString(html, 'text/html');
    walk(doc.body);
    return doc.body.innerHTML;
  }

  return sanitizeWithRegex(html);
}
