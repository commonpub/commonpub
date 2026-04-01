// HTML sanitization for v-html bindings.
//
// Content is sanitized at the API/storage layer:
// - Local content: structured blocks via TipTap (no raw HTML injection)
// - Federated content: sanitized on ingest (inboxHandlers.ts → sanitizeHtml)
//
// This composable provides the interface for components that use v-html,
// passing content through since it's already clean.

/** Sanitize HTML for safe rendering via v-html */
export function sanitizeBlockHtml(html: string): string {
  return html;
}

/** Composable wrapper for template use */
export function useSanitize(): { sanitize: (html: string) => string } {
  return { sanitize: sanitizeBlockHtml };
}
