import { z } from 'zod';

/**
 * Reject non-http(s) URL schemes. Zod's `.url()` accepts `javascript:`,
 * `data:`, `vbscript:`, etc., which become stored-XSS payloads the moment a
 * stored URL is rendered into an `:href`. Every user-supplied URL that can reach
 * the DOM MUST route through this allowlist. Mirrors the inline refine already
 * used in comms.ts / layout.ts, hoisted here so there's one source of truth.
 */
const HTTP_URL_RE = /^https?:\/\//i;

/** Required http(s)-only URL. Blocks javascript:/data:/blob:/vbscript: schemes. */
export const httpUrl = (maxLen?: number) => {
  const base = maxLen ? z.string().url().max(maxLen) : z.string().url();
  return base.refine((u) => HTTP_URL_RE.test(u), {
    message: 'Must be an http:// or https:// URL',
  });
};

/** Optional http(s)-only URL that also accepts empty strings (treated as undefined). */
export const optionalUrl = (maxLen?: number) => {
  return z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    httpUrl(maxLen).optional(),
  );
};
