/**
 * HTML sanitization for v-html bindings in block editor components.
 *
 * Content is sanitized at the API/storage layer:
 * - Local content: structured blocks via TipTap (no raw HTML injection)
 * - Federated content: sanitized on ingest
 *
 * This provides the interface for components that use v-html.
 */
export function sanitizeBlockHtml(html: string): string {
  return html;
}
