/**
 * GET /api/public/v1/members/open-to/{audience}
 *
 * The opt-in member visibility directory: the members who have asked to be
 * findable by this audience, listed to ONE named recipient, with every
 * disclosure written to `disclosure_events` inside the transaction that read
 * them.
 *
 * WHAT THIS ENDPOINT IS, said plainly, because a people-lister deserves it.
 * These are consenting, identified members. There is no email in the payload
 * and there is no contact channel here at all: a recipient reaches somebody
 * through the DMs any two accounts on this instance already have, subject to
 * the same blocking and reporting as every other message. Being listed signals
 * willingness and grants nothing else. Every read is logged per recipient and
 * the member can see who looked.
 *
 * NOT UNDER `/metrics/`, deliberately. A list of people under a metrics prefix
 * is a category error that invites somebody to hand it an analytics key. The
 * aggregate persona endpoints next door exist to make individuals
 * UNIDENTIFIABLE (floors, suppression, quantisation); this one identifies them
 * on purpose. `packages/server/src/persona/directory.ts` and `.../metrics.ts`
 * are separate modules that import nothing from each other (plan D1), and this
 * route touches only the first.
 *
 * FOUR GATES, IN THIS ORDER, and the order is the design:
 *
 *  1. `requireFeature('persona' | 'dataSharingConsents' | 'memberDirectory')`.
 *     404, never 403, and BEFORE the scope check, so an instance that does not
 *     run the directory does not reveal that the surface exists (a caller
 *     watching 403-vs-404 could otherwise probe for it with a junk key).
 *     `dataSharingConsents` is in the list because it governs the page where a
 *     member gives and withdraws the grant this endpoint reads: the disclosure
 *     must not outlive the ability to manage it (Art. 7(3)).
 *  2. `requireApiScope('read:members')`. Wildcard protected, so a `read:*` key
 *     is refused: every key already in the field was issued to read content and
 *     instance metrics, and this is the only scope that returns identified
 *     people.
 *  3. **The recipient binding.** 403 unless the key carries a `recipient_id`
 *     that resolves against the effective recipient list AND that recipient's
 *     declared `purposes` include the purpose this audience maps to. This is
 *     what makes a disclosure attributable: without it, `disclosure_events`
 *     could only record "somebody with a key", and "who has my data" would be
 *     unanswerable, which is the whole product.
 *  4. The MEMBER's consent, which is not checked here at all. It is an INNER
 *     JOIN inside `listOpenMembers`, bound to the live scope digest, so there
 *     is no version of the query that reads a member without it.
 *
 * THE DIGEST THIS ROUTE COMPUTES. `currentPurposeScope` is passed both
 * resolvers: the persona registry (so the digest covers DB schema overrides,
 * not just the file) and `effectiveDataSharingDocument` (so it covers
 * DB-declared recipients, not just the file's). The second one is load bearing
 * here in a way it is not for the aggregates: `resolveKeyRecipient` accepts a
 * recipient from EITHER half of the union, so a digest computed over the file
 * alone would let an admin-added recipient read members whose grant was given
 * before that recipient was ever named to them. With the resolver, adding a
 * recipient moves the digest, every existing grant degrades to "needs
 * reconfirmation", and this endpoint returns nobody until members confirm
 * against the new list. That is the correct direction to fail in.
 */
import {
  MemberDirectoryError,
  DIRECTORY_LIMIT_DEFAULT,
  DIRECTORY_LIMIT_MAX,
  DIRECTORY_LOCATION_MAX_LENGTH,
  DIRECTORY_Q_MAX_LENGTH,
  currentPurposeScope,
  directoryPurpose,
  effectiveDataSharingDocument,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  isDirectoryAudience,
  listOpenMembers,
  recipientCoversPurpose,
  resolveKeyRecipient,
  type OpenMember,
} from '@commonpub/server';
import type { ApiKey } from '@commonpub/schema';
import { z } from 'zod';

/**
 * Filter values, accepted repeated (`?interests=a&interests=b`) or
 * comma-joined (`?interests=a,b`), because both spellings are in the wild and
 * a caller should not have to guess which one this API took.
 *
 * Splitting on `,` is unambiguous rather than convenient: persona option values
 * and field keys match `^[a-z0-9_]+$`, so no legal value can contain a comma.
 * A value that does contain one cannot match a real option and is refused by
 * name downstream as an unknown option rather than silently matching nothing.
 */
const MAX_FILTER_VALUES = 64;

/** Longest single filter value worth binding: the persona option-value cap. */
const MAX_FILTER_VALUE_LENGTH = 64;

const filterValues = z
  .union([z.string(), z.array(z.string())])
  .transform((raw) =>
    (Array.isArray(raw) ? raw : [raw])
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  )
  .pipe(z.array(z.string().max(MAX_FILTER_VALUE_LENGTH)).max(MAX_FILTER_VALUES));

/**
 * `limit` tops out at 50, half the metrics family's 100, and the reason is not
 * performance: these are people. A ceiling is the cheapest bound on bulk
 * extraction that needs no state, and it composes with the per-key rate limit
 * and the operator's disclosure panel. The constants come from the directory
 * module so the contract, the clamp and this schema cannot disagree.
 */
const querySchema = z.object({
  interests: filterValues.optional(),
  techStack: filterValues.optional(),
  industry: filterValues.optional(),
  hasLink: filterValues.optional(),
  location: z.string().max(DIRECTORY_LOCATION_MAX_LENGTH).optional(),
  q: z.string().max(DIRECTORY_Q_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(DIRECTORY_LIMIT_MAX).default(DIRECTORY_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface OpenMembersResponse {
  items: OpenMember[];
  total: number | null;
  hasMore: boolean;
  limit: number;
  offset: number;
  /**
   * How many `disclosure_events` rows this response wrote. Always equal to
   * `items.length`, and published rather than hidden: a recipient should be
   * able to see that they are being logged, and an integrator reconciling their
   * own records against an operator's disclosure panel needs the number.
   */
  disclosed: number;
}

export default defineEventHandler(async (event): Promise<OpenMembersResponse> => {
  requireFeature('persona');
  requireFeature('dataSharingConsents');
  requireFeature('memberDirectory');
  requireApiScope(event, 'read:members');

  const audience = getRouterParam(event, 'audience');
  // An unrecognised audience is a 404 (this path does not exist), never a 500
  // and never a 400: the two audiences are a published, static part of the
  // contract, so a third one is a wrong URL rather than a bad parameter.
  if (audience === undefined || !isDirectoryAudience(audience)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  const purpose = directoryPurpose(audience);

  const db = useDB();
  const config = useConfig();

  // AUTHORISATION BEFORE VALIDATION. A key that may not read this audience gets
  // 403 whether or not its query is well formed, so a caller cannot learn
  // anything about the filter surface it is not entitled to use.
  const apiKey = event.context.apiKey as ApiKey | undefined;
  const recipient = await resolveKeyRecipient(db, config, apiKey ?? {});
  if (recipient === null) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'This key is not bound to a named data recipient. Every disclosure must be attributable, '
        + 'so an operator has to bind it to a recipient this instance declares.',
    });
  }
  if (!recipientCoversPurpose(recipient, purpose)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Recipient "${recipient.id}" is not declared for ${purpose}`,
    });
  }

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    });
  }

  // Resolved once, together: the digest must be computed over the SAME sections
  // the projection reads, or a schema override would move the digest under a
  // page that had already decided which fields to publish.
  const [{ sections, drift }, linkPlatforms] = await Promise.all([
    effectivePersonaSchema(db, config),
    effectivePersonaLinkPlatforms(db, config),
  ]);
  const scope = await currentPurposeScope(db, config, {
    sections: async () => sections,
    dataSharing: effectiveDataSharingDocument,
  });

  // The same drift rule `/api/users/:username/persona` applies to a member's
  // own public profile: a key whose type or sink changed has its stored answers
  // withheld, because printing a value under a question that has since changed
  // meaning misdescribes the person. `missing_option` is handled per value
  // inside the projection (the withdrawn option is dropped, the field survives)
  // rather than by withholding the whole field.
  const driftedFieldKeys = drift
    .filter((entry) => entry.kind !== 'missing_option')
    .map((entry) => entry.fieldKey);

  try {
    const page = await listOpenMembers(db, {
      audience,
      scopeDigest: scope.digest,
      sections,
      linkPlatforms,
      driftedFieldKeys,
      filters: {
        interests: parsed.data.interests,
        techStack: parsed.data.techStack,
        industry: parsed.data.industry,
        hasLink: parsed.data.hasLink,
        location: parsed.data.location,
        q: parsed.data.q,
      },
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      recipientId: recipient.id,
      apiKeyId: apiKey?.id ?? null,
    });

    return {
      items: page.items,
      total: page.total,
      hasMore: page.hasMore,
      limit: page.limit,
      offset: page.offset,
      disclosed: page.disclosed,
    };
  } catch (err) {
    // The directory module carries the status on the error rather than making
    // each caller map a code, so an unknown filter key stays a clean 400 and a
    // purpose whose copy does not cover disclosing identity stays a 404. The
    // machine `code` is echoed so an integrator can branch without parsing
    // prose; nothing else about the failure is.
    if (err instanceof MemberDirectoryError) {
      throw createError({
        statusCode: err.status,
        statusMessage: err.message,
        data: { code: err.code, field: err.field },
      });
    }
    throw err;
  }
});
