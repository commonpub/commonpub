import type { PlatformHandler, ImportResult } from './types.js';
import { safeFetch } from './ssrf.js';
import { extractArticle } from './generic.js';
import { hacksterHandler } from './platforms/hackster.js';

/** Registered platform handlers — checked in order */
const PLATFORM_HANDLERS: PlatformHandler[] = [
  hacksterHandler,
];

/**
 * Import content from an external URL.
 * Fetches the page, detects the platform, and extracts structured content.
 */
export async function importFromUrl(urlString: string): Promise<ImportResult> {
  const url = parseAndValidateUrl(urlString);
  const { html } = await safeFetch(url.toString());

  // Check for a platform-specific handler
  for (const handler of PLATFORM_HANDLERS) {
    if (handler.match(url)) {
      return handler.import(url, html);
    }
  }

  // Fallback to generic extraction
  return extractArticle(html, url.toString());
}

function parseAndValidateUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('URL must use HTTP or HTTPS');
  }

  return url;
}
