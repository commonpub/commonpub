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
  // Aggregate persona/audience cohorts. Deliberately NOT covered by `read:*`
  // (see WILDCARD_PROTECTED_SCOPES): a key issued for content metrics must not
  // silently gain member cohort data.
  'read:audience',
  // Individual, consenting members through the opt-in visibility directory.
  // Deliberately NOT covered by `read:*` (see WILDCARD_PROTECTED_SCOPES): this
  // is the only scope that returns identified people rather than aggregates,
  // and a key issued for content metrics must never pick it up silently. It
  // additionally requires the key to carry a `recipient_id`, so every
  // disclosure it makes is attributable to a named party.
  'read:members',
  'read:federation',
  'read:instance',
  'read:*',
] as const;

export const publicApiScopeSchema = z.enum(PUBLIC_API_SCOPES);
export type PublicApiScope = z.infer<typeof publicApiScopeSchema>;

/**
 * Scopes `read:*` does NOT cover. A key must hold one of these by name.
 *
 * Adding a scope here narrows every existing key, which is the point: a key
 * issued to read content metrics was granted by someone who agreed to content
 * metrics, and a wildcard that silently widened as new scopes shipped would
 * turn every past grant into a blank cheque. It belongs in the same commit as
 * the `PUBLIC_API_SCOPES` entry; the tuple edit alone is the regression.
 *
 * Declared here rather than in `@commonpub/server` because three surfaces read
 * it and one of them is a browser: `hasScope` enforces it, `docs/public-api.md`
 * publishes it, and the admin key screen tells an operator that ticking
 * `read:*` will not cover it. Two hand-written copies of that list is how the
 * checkbox comes to promise something the gate refuses.
 */
export const WILDCARD_PROTECTED_SCOPES: readonly PublicApiScope[] = [
  'read:audience',
  // Same commit as the `read:members` tuple entry above, per the paragraph
  // directly overhead: the tuple edit alone is the regression. Nothing in the
  // field holds `read:members` yet, so this narrows no issued key; it only
  // closes the wildcard before the first member-listing surface exists.
  'read:members',
];

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

/**
 * Recipient id alphabet, matching `dataRecipientSchema` in `@commonpub/persona`
 * and the `varchar(40)` of `api_keys.recipient_id`. Declared here rather than
 * imported because `@commonpub/schema` must not gain an edge to a feature
 * package (persona plan 14.3); the two are pinned equal by a test.
 */
const RECIPIENT_ID_PATTERN = /^[a-z0-9_-]{1,40}$/;

export const createApiKeySchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional().nullable(),
    scopes: z.array(publicApiScopeSchema).min(1),
    expiresAt: z.coerce.date().optional().nullable(),
    rateLimitPerMinute: z.number().int().min(1).max(10_000).optional(),
    allowedOrigins: z.array(originPatternSchema).max(50).optional().nullable(),
    /**
     * Binds the key to one named recipient from `dataSharing.recipients`, so
     * every disclosure it makes is attributable to a party the instance has
     * declared and papered. Optional, because only `read:members` needs it.
     */
    recipientId: z
      .string()
      .trim()
      .regex(RECIPIENT_ID_PATTERN, {
        message: 'Recipient id must be 1-40 characters of a-z, 0-9, hyphen or underscore.',
      })
      .optional()
      .nullable(),
  })
  .refine((v) => !v.scopes.includes('read:members') || Boolean(v.recipientId), {
    // A `read:members` key with no binding is refused at 403 on every request,
    // so creating one produces a key that can never read anything. Refusing it
    // here closes the path that does not go through the admin form (curl, a
    // fork's own UI) rather than leaving a dead token in the list.
    message: 'A key holding read:members must name the recipient it belongs to.',
    path: ['recipientId'],
  });
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
