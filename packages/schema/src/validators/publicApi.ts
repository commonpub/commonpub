import { z } from 'zod';

// --- Public API keys ---

export const PUBLIC_API_SCOPES = [
  'read:content',
  'read:hubs',
  'read:users',
  'read:learn',
  'read:events',
  'read:contests',
  'read:videos',
  'read:docs',
  'read:tags',
  'read:search',
  'read:analytics',
  'read:federation',
  'read:instance',
  'read:*',
] as const;

export const publicApiScopeSchema = z.enum(PUBLIC_API_SCOPES);
export type PublicApiScope = z.infer<typeof publicApiScopeSchema>;

/**
 * CORS origin pattern for an API key's allow-list. The only wildcard
 * metacharacter is `*`. Accepts:
 *   *                        any origin (wildcard-all)
 *   localhost                shorthand for http(s)://localhost on any port
 *   https://app.example.com  exact origin
 *   http://localhost:*       any port on a host
 *   https://*.example.com    any subdomain
 *   *://localhost:*          any scheme + any port
 *
 * Only `http`/`https` (or `*`) schemes are accepted, so `javascript:` /
 * `data:` and other schemes are rejected (the URL-scheme refinement lesson —
 * Zod's `.url()` is too permissive and rejected `*`/`localhost` outright,
 * which is the bug this replaces). Matching lives in `@commonpub/server`'s
 * `matchOrigin`; this schema is the write-time gate.
 */
const ORIGIN_PATTERN =
  /^(?:\*|localhost|(?:https?|\*):\/\/(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?)$/i;

export const originPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((v) => ORIGIN_PATTERN.test(v), {
    message:
      'Must be "*", "localhost", or an origin like https://app.example.com. Wildcards (*) are allowed for scheme, subdomain, or port.',
  });

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  scopes: z.array(publicApiScopeSchema).min(1),
  expiresAt: z.coerce.date().optional().nullable(),
  rateLimitPerMinute: z.number().int().min(1).max(10_000).optional(),
  allowedOrigins: z.array(originPatternSchema).max(50).optional().nullable(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
