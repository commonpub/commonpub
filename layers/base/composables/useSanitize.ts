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

// ---------------------------------------------------------------------------
// Rich HTML mode (the opt-in "Full HTML" content format, e.g. contest pages).
//
// A deliberately PERMISSIVE but still DEFAULT-DENY allowlist: it renders an
// author's presentational HTML verbatim — layout tags, inline CSS, SVG icons —
// while never permitting script execution. Anything not on the allowlist is
// dropped, so `<script>`, `<iframe>`, `<object>`, `<style>`, `on*` handlers and
// `javascript:` URLs cannot get through. Authoring is gated to trusted
// (staff/admin) contest creators and is opt-in per contest. Tag/attr NAME case
// is preserved on output so case-sensitive SVG names (viewBox, linearGradient)
// survive. The `style` attribute is allowed but its value is scrubbed of the
// exfil/script vectors (url(), expression(), javascript:, @import, behavior).
// ---------------------------------------------------------------------------

const RICH_ALLOWED_ELEMENTS = new Set([
  'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'figure', 'figcaption', 'address',
  'p', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'kbd', 'samp', 'var', 'cite', 'q', 'wbr', 'small', 'mark', 'abbr', 'time', 'sub', 'sup',
  'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img', 'picture', 'source',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'details', 'summary', 'button',
  // SVG (lowercased for the allowlist check; original case preserved on output)
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs',
  'lineargradient', 'radialgradient', 'stop', 'text', 'tspan', 'use', 'symbol', 'clippath', 'mask', 'pattern', 'marker',
]);

// Attributes allowed on any rich element (lowercased). `aria-*`/`data-*` are
// allowed by prefix; per-tag extras and `style` are handled separately.
const RICH_GLOBAL_ATTRS = new Set([
  'class', 'id', 'title', 'role', 'lang', 'dir', 'slot', 'tabindex', 'hidden', 'datetime', 'open',
  // SVG presentation
  'viewbox', 'xmlns', 'version', 'preserveaspectratio', 'transform', 'opacity',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit', 'clip-rule', 'clip-path', 'mask',
  'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'd', 'points', 'width', 'height',
  'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'font-weight', 'letter-spacing',
  'marker-start', 'marker-mid', 'marker-end',
]);

const RICH_PER_TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'target', 'name']),
  img: new Set(['src', 'alt', 'loading', 'decoding']),
  source: new Set(['type', 'media', 'sizes']),
  td: new Set(['colspan', 'rowspan', 'headers']),
  th: new Set(['colspan', 'rowspan', 'headers', 'scope']),
  ol: new Set(['start', 'type', 'reversed']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  button: new Set(['type']),
  use: new Set(['href']),
};

const RICH_URL_ATTRS = new Set(['href', 'src', 'xlink:href']);
// CSS constructs that can fetch, exfiltrate, or execute — stripped per-declaration.
const STYLE_DECL_BLOCKLIST = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import|url\s*\(/i;

// Color neutralization (opt-in, for dark-mode-safe author HTML). A declaration of
// one of these properties whose value is a HARDCODED color literal (hex / rgb()/
// hsl() / common named) is dropped so the themed `.cpub-md-html` baseline shows
// through — but theme-adaptive values (var(), currentColor, inherit, transparent)
// are KEPT, so an author who writes `color: var(--text)` is respected.
const COLOR_PROPS = new Set(['color', 'background', 'background-color', 'border-color', 'outline-color']);
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|maroon|navy|teal|olive|lime|aqua|cyan|magenta|brown|beige|ivory|crimson|coral|salmon|khaki|indigo|violet)\b/i;
const ADAPTIVE_COLOR = /var\(|currentcolor|inherit|transparent|initial|unset/i;

function isClashingColorDecl(decl: string): boolean {
  const ci = decl.indexOf(':');
  if (ci <= 0) return false;
  const prop = decl.slice(0, ci).trim().toLowerCase();
  if (!COLOR_PROPS.has(prop)) return false;
  const val = decl.slice(ci + 1);
  if (ADAPTIVE_COLOR.test(val)) return false;
  return LITERAL_COLOR.test(val);
}

function sanitizeStyleAttr(value: string, neutralizeColors = false): string {
  return value
    .split(';')
    .filter((decl) => {
      if (!decl.trim() || STYLE_DECL_BLOCKLIST.test(decl)) return false;
      if (neutralizeColors && isClashingColorDecl(decl)) return false;
      return true;
    })
    .join(';');
}

export interface SanitizeRichOptions {
  /**
   * Drop inline hardcoded color/background literals so the themed render baseline
   * (dark-safe) shows through. Theme-adaptive values (var(), currentColor) are
   * kept. Off by default (general-purpose rendering preserves author colors);
   * on for the contest "Full HTML" fields so a pasted light-mode document stays
   * readable in dark mode.
   */
  neutralizeColors?: boolean;
}

/** Sanitize author HTML for "full HTML" rendering — permissive but script-free. */
export function sanitizeRichHtml(html: string, opts: SanitizeRichOptions = {}): string {
  if (!html || typeof html !== 'string') return '';

  let result = html.replace(/<!--[\s\S]*?-->/g, '');

  // Remove raw-text / active elements WITH their contents, so script/style/embed
  // bodies don't leak through as visible text or execute. The tag pass below
  // also drops these by allowlist, but only the open/close tags — this strips
  // the inner payload (e.g. `<script>code</script>` → '' rather than `code`).
  result = result.replace(/<(script|style|noscript|template|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)?\/?>/g, (match, rawTag: string, attrs?: string) => {
    const tag = rawTag.toLowerCase();
    if (!RICH_ALLOWED_ELEMENTS.has(tag)) return '';
    if (match.startsWith('</')) return `</${rawTag}>`;

    const safeAttrs: string[] = [];
    if (attrs) {
      const attrRegex = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const rawName = attrMatch[1]!;
        const name = rawName.toLowerCase();
        const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

        if (name.startsWith('on')) continue; // event handlers never allowed
        const allowed =
          name === 'style' ||
          RICH_GLOBAL_ATTRS.has(name) ||
          name.startsWith('aria-') ||
          name.startsWith('data-') ||
          (RICH_PER_TAG_ATTRS[tag]?.has(name) ?? false);
        if (!allowed) continue;

        if (RICH_URL_ATTRS.has(name) && !isSafeUrl(value)) continue;

        if (name === 'style') {
          const cleaned = sanitizeStyleAttr(value, opts.neutralizeColors);
          if (cleaned) safeAttrs.push(`style="${escapeAttrValue(cleaned)}"`);
          continue;
        }
        safeAttrs.push(`${rawName}="${escapeAttrValue(value)}"`);
      }
    }

    const attrsStr = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
    const selfClose = match.endsWith('/>') ? ' /' : '';
    return `<${rawTag}${attrsStr}${selfClose}>`;
  });

  return result;
}

/** Composable wrapper for template use */
export function useSanitize(): { sanitize: (html: string) => string; sanitizeRich: (html: string) => string } {
  return { sanitize: sanitizeBlockHtml, sanitizeRich: sanitizeRichHtml };
}
