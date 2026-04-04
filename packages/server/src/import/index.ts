/**
 * Content import service — extract content from external URLs.
 *
 * Detects the platform from the URL hostname and dispatches to a
 * platform-specific handler when available, falling back to the
 * generic Readability-based extractor for everything else.
 */
export type { ImportResult, PlatformHandler } from './types.js';
export { importFromUrl } from './importer.js';
