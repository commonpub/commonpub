import { z } from 'zod';

/**
 * Reject non-http(s) URL schemes. Zod's `.url()` accepts `javascript:`,
 * `data:`, `vbscript:`, etc., which become stored-XSS payloads the moment a
 * stored URL is rendered into an `:href`. Every user-supplied URL that can reach
 * the DOM MUST route through this allowlist.
 *
 * This is a deliberate, documented COPY of the helper in
 * `packages/schema/src/validators/_shared.ts`, not an import of it. Section 14.4:
 * importing it would create a permanent `@commonpub/persona -> @commonpub/schema`
 * edge (or, in the other direction proposed by section 3.1, a
 * `schema -> config` edge) for one validator, and this package's whole point is
 * that it depends on `zod` and nothing else. The two copies are eight lines,
 * behaviourally identical, and this one has its own test asserting it rejects
 * the same schemes.
 */
const HTTP_URL_RE = /^https?:\/\//i;

/** Required http(s)-only URL. Blocks javascript:/data:/blob:/vbscript: schemes. */
export const httpUrl = (maxLen?: number): z.ZodType<string> => {
  const base = maxLen ? z.string().url().max(maxLen) : z.string().url();
  return base.refine((u) => HTTP_URL_RE.test(u), {
    message: 'Must be an http:// or https:// URL',
  });
};

/** Optional http(s)-only URL that also accepts empty strings (treated as undefined). */
export const optionalUrl = (maxLen?: number): z.ZodType<string | undefined> => {
  return z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    httpUrl(maxLen).optional(),
  );
};
