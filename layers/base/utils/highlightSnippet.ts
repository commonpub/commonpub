/**
 * Render a Postgres `ts_headline` snippet safely.
 *
 * `ts_headline` wraps matched tokens in `<b>...</b>` (and nothing else by
 * default). The input text has already been HTML-tag-stripped on the
 * server (see packages/server/src/docs/docs.ts `searchDocsPages` — the
 * `extracted.text_content` CTE uses `regexp_replace` to pull tags out
 * before tokenization). So the only HTML we should ever see in the
 * returned string is the `<b>` markers ts_headline itself emits.
 *
 * To be safe anyway: HTML-escape the whole string, then restore exactly
 * `<b>` and `</b>`. Anything else — including attributes on `<b>` or any
 * other tag that somehow slipped through — becomes harmless escaped text.
 *
 * Return value is intended for `v-html`.
 */
export function highlightSnippet(snippet: string | null | undefined): string {
  if (!snippet) return '';
  const escaped = snippet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  // Restore only bare <b> / </b> (no attributes, no whitespace variants).
  return escaped
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>');
}
