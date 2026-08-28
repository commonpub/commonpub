/**
 * The single URL-scheme gate for every sanitizer in this package.
 *
 * WHY THIS IS ONE MODULE AND NOT A HELPER IN EACH SANITIZER.
 * `@commonpub/explainer` shipped TWO sanitizers with two different, both-wrong
 * attempts at the same job — `vue/utils/sanitize.ts` and
 * `src/render/sectionRenderer.ts` — each neutralising dangerous URLs with a
 * variation on `.replace(/javascript:/gi, '')`. A single-pass string replace
 * cannot do this, and between them they failed 12 of 24 vectors in a real browser
 * DOM parser. Fixing one and leaving the other is how a package ends up with a
 * third broken copy, so the logic lives here and both import it.
 *
 * WHY DEFAULT-DENY ON THE SCHEME RATHER THAN A DENYLIST.
 * A denylist has to anticipate every encoding the HTML parser and the URL parser
 * will undo *after* the regex has run. A scheme allowlist does not. The vectors
 * that beat the denylist versions:
 *
 *   javasjavascript:cript:   a single-pass replace removes the INNER occurrence
 *                            and the two halves close up into `javascript:`
 *   java<TAB>script:         the URL parser discards the tab; the regex does not
 *   java<LF>script:          same, and <CR> likewise
 *   javascript&#58;          the HTML parser decodes the entity AFTER the regex ran
 *   javascript&#x3a;         hex form
 *   javascript&#0000058;     zero-padded
 *   javascript&#58alert(1)   browsers accept a numeric entity with no semicolon
 *   javascript&colon;        named entity
 *   java&Tab;script:         named entity for a discarded character
 *   data:text/html;base64,…  never handled at all
 *   vbscript:                never handled at all
 */

/**
 * Decode what a browser will decode inside an attribute value, then strip what it
 * discards while reading a scheme. Order matters: entities first (they can produce
 * the very characters we then strip), stripping second.
 */
export function decodeForSchemeCheck(value: string): string {
  return (
    value
      .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&(colon|tab|newline);?/gi, (_, name: string) =>
        /colon/i.test(name) ? ':' : /tab/i.test(name) ? '\t' : '\n')
      // Everything from NUL through SPACE is discarded by the URL parser while it
      // reads a scheme. The control range IS the subject here.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0020]/g, '')
  );
}

/**
 * NOTE: this decoder is deliberately MORE aggressive than the HTML parser.
 *
 * Measured against Chromium: named character references are case-SENSITIVE and,
 * outside the legacy set, require their semicolon — so `&COLON;`, `&Colon;`,
 * `&colon` (no semicolon), `&tab;` and `&newline;` are NOT decoded by a browser and
 * a URL containing them resolves as relative, not executable. This function decodes
 * them anyway (the regex is `/gi` with an optional `;`), so those five URLs are
 * refused even though no browser would run them.
 *
 * That is the right trade for a security gate: over-blocking costs one dropped href
 * in a contrived URL; under-blocking costs XSS. Of 19 encodings checked against the
 * real parser there were **zero** cases the browser executes and this function
 * allows, and five it refuses unnecessarily. Keep the margin.
 * Pinned by the OVER_BLOCKED group in `__tests__/urlSafety.test.ts`.
 */

/** Schemes that cannot execute. Everything else — including `data:`, which can
 *  carry `text/html` — is refused. A URL with no scheme at all is relative, and fine. */
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

export function isSafeUrl(value: string): boolean {
  const decoded = decodeForSchemeCheck(value);
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(decoded);
  if (!scheme) return true; // relative, fragment, query, or protocol-relative
  return SAFE_SCHEMES.has(scheme[1]!.toLowerCase());
}
