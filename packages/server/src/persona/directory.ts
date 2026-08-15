import { and, desc, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { QueryBuilder, alias } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  disclosureEvents,
  userPersonaAnswers,
  userPersonaText,
  userPurposeConsents,
  userSharedLinks,
  users,
} from '@commonpub/schema';
import {
  PROCESSING_PURPOSE_SPECS,
  personaFieldSink,
  personaFieldSpec,
  purposeCovers,
} from '@commonpub/persona';
import type {
  PersonaDataClass,
  PersonaField,
  PersonaLinkPlatformSpec,
  PersonaSection,
  ProcessingPurposeId,
} from '@commonpub/persona';
import type { DB } from '../types.js';
import { toPageMeta } from '../query.js';
import { toPublicUser } from '../publicApi/serializers.js';
import type { PublicUser, PublicUserRow } from '../publicApi/serializers.js';

/**
 * The opt-in member visibility directory: consenting, IDENTIFIED members listed
 * to a named recipient, with every disclosure logged before the payload leaves.
 *
 * D1, THE RULE THIS MODULE EXISTS TO KEEP. This is not metrics and it must never
 * share a module with the aggregate pipeline. `./metrics.ts` exists to make
 * individuals UNIDENTIFIABLE: `HAVING count(*) >= minBucket`, quantised counts,
 * finalised-day-only reads, whole-field suppression. This module identifies a
 * named individual to a named recipient ON PURPOSE, with that person's consent
 * and with an audit row per disclosure. Routed through one module, either the
 * directory returns nothing (k-anonymity applied to a list of people suppresses
 * the list) or somebody deletes the suppression to make the directory work and
 * silently breaks every aggregate on the instance. So:
 *
 * - **This file imports nothing from `./metrics.ts`, and `./metrics.ts` imports
 *   nothing from this file.** A source sweep asserts both directions by name.
 * - **There is no k-anonymity here and that is correct.** No floor, no
 *   suppression, no quantisation. The rows are consenting people who asked to be
 *   listed. There is no leak back into the aggregates either: this set is a
 *   strict subset of the consenting population, so it says nothing about anybody
 *   who did not opt in.
 *
 * D2, the second rule a later reader will want to "fix". The grant required here
 * is the SPECIFIC purpose (`recruiter_visibility` / `sponsor_sharing`) and
 * nothing else. It briefly looked as though the aggregate side's second join
 * belonged here too; it never did, and that join is gone from `metrics.ts`
 * anyway now that statistics run on legitimate interest rather than consent.
 * `recruiter_visibility`'s copy describes exactly this disclosure and no other
 * record does, so requiring a second grant would exclude the people who agreed
 * to precisely the thing being done. Adding one is a defect, not a hardening.
 *
 * D2b, THE ONE THING THAT IS NOT DECIDED BY THE GRANT ALONE. Profile link
 * platforms pass a per-member, per-platform gate as well
 * (`user_shared_links`, plan R3.1 D6): row present means shared, absent means
 * not. It applies to the projection AND to the `hasLink` filter, because a
 * filter that matches on a withheld link discloses that the link exists. The
 * statistics link aggregate next door intersects the same table, so one control
 * means one thing everywhere a member could be asked to hold it in their head.
 *
 * D3, why the write is not a fire-and-forget log. `recordDisclosures` runs in
 * the SAME transaction as the read, before the payload is serialised. A failed
 * insert rolls the read back and fails the request, because a disclosure nobody
 * recorded is a disclosure the member can never be told about, which fails Art.
 * 15 and makes bulk extraction invisible.
 *
 * D4, why email cannot leak. The projection goes through `toPublicUser`, which
 * has no email field at all, rather than selecting columns and remembering to
 * drop one. Email is structurally absent, not filtered out.
 *
 * Feature gating (`persona`, `dataSharingConsents`, `memberDirectory`), the
 * `read:members` scope and the API key's recipient binding all happen at the
 * route boundary. This package is framework-agnostic and takes resolved values.
 */

// --- Audiences ------------------------------------------------------------------

/** The `{audience}` path segment of `/api/public/v1/members/open-to/{audience}`. */
export const DIRECTORY_AUDIENCES = ['recruiters', 'sponsors'] as const;

export type DirectoryAudience = (typeof DIRECTORY_AUDIENCES)[number];

/**
 * The ONE map from a URL audience to the purpose that authorises it.
 *
 * `satisfies` so a new audience cannot be added without naming a real purpose,
 * and so the mapping exists once as data rather than as a `switch` in the route
 * plus a second one in the disclosure writer.
 */
export const DIRECTORY_AUDIENCE_PURPOSES = {
  recruiters: 'recruiter_visibility',
  sponsors: 'sponsor_sharing',
} as const satisfies Record<DirectoryAudience, ProcessingPurposeId>;

export function isDirectoryAudience(value: string): value is DirectoryAudience {
  return (DIRECTORY_AUDIENCES as readonly string[]).includes(value);
}

/** The purpose a given audience's listing requires a current grant for. */
export function directoryPurpose(audience: DirectoryAudience): ProcessingPurposeId {
  return DIRECTORY_AUDIENCE_PURPOSES[audience];
}

// --- Errors ---------------------------------------------------------------------

/**
 * A directory request that cannot be served, with the status a route should
 * surface carried on the error rather than mapped in each caller.
 *
 * Modelled on `PurposeConsentError` next door, and deliberately NOT a subclass
 * of it: importing the consent module for an error base would give the directory
 * a dependency on the consent WRITE path, which it has no business holding.
 */
export class MemberDirectoryError extends Error {
  /** Stable machine code, safe to render to a client. */
  public readonly code: string;
  /** HTTP status a route should surface. */
  public readonly status: number;
  /** The offending filter name, when the failure is about one. */
  public readonly field?: string;

  constructor(message: string, opts: { code: string; status: number; field?: string }) {
    super(message);
    this.name = 'MemberDirectoryError';
    this.code = opts.code;
    this.status = opts.status;
    this.field = opts.field;
  }
}

// --- Pagination bounds ----------------------------------------------------------

/**
 * Lower than the metrics family's 100 on purpose: these are people, not buckets.
 * A ceiling is the cheapest bound on bulk extraction that does not need state,
 * and it composes with the per-key rate limit and the disclosure panel.
 */
export const DIRECTORY_LIMIT_MAX = 50;
export const DIRECTORY_LIMIT_DEFAULT = 20;

// --- Filters --------------------------------------------------------------------

/**
 * Query parameter name -> persona FIELD KEY.
 *
 * The wire names are camelCase because the rest of the public API is; the field
 * keys are the operator's schema keys (`^[a-z0-9_]+$`). Every one of them is
 * still resolved against the EFFECTIVE schema below, so this map decides only
 * which parameters exist, never that a field does.
 */
export const DIRECTORY_ANSWER_FILTERS = {
  interests: 'interests',
  techStack: 'tech_stack',
  industry: 'industry',
} as const;

export type DirectoryAnswerFilterName = keyof typeof DIRECTORY_ANSWER_FILTERS;

export const DIRECTORY_ANSWER_FILTER_NAMES = Object.keys(
  DIRECTORY_ANSWER_FILTERS,
) as DirectoryAnswerFilterName[];

/** Free-text filter caps, matched to the columns they search. */
export const DIRECTORY_Q_MAX_LENGTH = 80;
export const DIRECTORY_LOCATION_MAX_LENGTH = 128;

export interface OpenMemberFilters {
  /** Repeatable. OR within the field, AND against every other filter. */
  interests?: readonly string[];
  techStack?: readonly string[];
  industry?: readonly string[];
  /**
   * Link platform keys the member must ALL have on their profile AND share.
   *
   * AND, not OR, and deliberately different from the answer filters. "Has a
   * GitHub link" is a capability requirement rather than a taste, and a caller
   * who wants either can issue two requests and merge, while a caller who wants
   * both cannot express that with any number of OR requests. The direction that
   * is not recoverable by the caller is the one the API should provide.
   */
  hasLink?: readonly string[];
  /** Substring match on the member's own `location` string. */
  location?: string;
  /** Username / display name search, identical to `GET /api/public/v1/users`. */
  q?: string;
}

// --- Input and output shapes ----------------------------------------------------

export interface ListOpenMembersInput {
  /** Which audience is asking. Decides the purpose, and nothing else. */
  audience: DirectoryAudience;
  /**
   * The CURRENT scope digest from `currentPurposeScope`. Bound INSIDE the join
   * condition, so a stale grant authorises nothing and there is no version of
   * this query without it.
   */
  scopeDigest: string;
  /** The effective persona schema (file plus DB overrides, retired keys gone). */
  sections: readonly PersonaSection[];
  /** The effective link platforms, for validating `hasLink`. */
  linkPlatforms: readonly PersonaLinkPlatformSpec[];
  /**
   * Field keys whose schema and stored rows disagree about type or sink. Skipped
   * in the projection for the same reason `/api/users/:username/persona` skips
   * them: printing a value under a question that has since changed meaning
   * misdescribes the person.
   */
  driftedFieldKeys?: readonly string[];
  filters?: OpenMemberFilters;
  limit?: number;
  offset?: number;
  /**
   * The recipient this key is bound to, already resolved and validated against
   * the effective recipient list by the caller. Written to every disclosure row.
   */
  recipientId: string;
  /** The key that made the request, so a revoked key's history stays attributable. */
  apiKeyId?: string | null;
}

/** One projected persona answer. Labels are resolved; raw option values are not published. */
export interface OpenMemberAnswer {
  fieldKey: string;
  label: string;
  /** `'chips'` for a closed vocabulary, `'text'` for free text. */
  display: 'chips' | 'text';
  /** Resolved option labels, or the single stored string for free text. */
  values: string[];
}

/**
 * A listed member.
 *
 * Extends `PublicUser`, which is the serializer with NO email field, so this
 * interface cannot grow one without someone editing the shared allow-list that
 * every other public endpoint reads.
 */
export interface OpenMember extends PublicUser {
  persona: OpenMemberAnswer[];
}

export interface OpenMembersPage {
  items: OpenMember[];
  /** Real count. See the note on `countMatching` about why it is not k-anonymised. */
  total: number | null;
  hasMore: boolean;
  limit: number;
  offset: number;
  /** Disclosure rows written for this response. Always equals `items.length`. */
  disclosed: number;
}

// --- Data classes -----------------------------------------------------------------

/**
 * The class this surface reads that has no substitute: the person's identity.
 *
 * `covers` is load bearing here exactly as `LINK_PRESENCE_DATA_CLASS` is in the
 * metrics module. A directory that lists people discloses `public_identity` by
 * definition, so a purpose whose registry entry does not cover that class cannot
 * back one, and this module refuses rather than serving the listing anyway.
 *
 * TODAY THAT REFUSES `sponsor_sharing`, and that is the correct answer rather
 * than a gap to route around. Its copy reads "your interests, your tech stack
 * and your public profile links are shared with the sponsors named below" and
 * its `covers` is `['persona_selections', 'profile_links']`: it never told
 * anybody their name, headline, bio or town would be handed over. Enabling the
 * sponsor audience is a `covers` edit AND a copy edit in
 * `@commonpub/persona`'s purpose registry, both of which move the scope digest
 * and re-ask every member who already agreed. That is the point: it is not a
 * one-line unlock, and it should not be.
 */
const DIRECTORY_IDENTITY_CLASS: PersonaDataClass = 'public_identity';

/** Per-class projection gates, so the payload cannot outrun the copy the member read. */
interface DirectoryDisclosureScope {
  /** `location_coarse`. When absent the town is dropped from the payload. */
  location: boolean;
  /**
   * `profile_links`. When absent `socialLinks` and `website` are dropped
   * outright. When present, `socialLinks` is still narrowed to the platforms
   * the member shares; this gate says what the PURPOSE may disclose, not what
   * this member agreed to.
   */
  links: boolean;
  /** `persona_selections`. When absent the persona answers are dropped. */
  answers: boolean;
}

function disclosureScope(purpose: ProcessingPurposeId): DirectoryDisclosureScope {
  return {
    location: purposeCovers(purpose, 'location_coarse'),
    links: purposeCovers(purpose, 'profile_links'),
    answers: purposeCovers(purpose, 'persona_selections'),
  };
}

// --- Filter resolution ------------------------------------------------------------

/** A validated answer filter: a real field key and values from its real vocabulary. */
interface ResolvedAnswerFilter {
  filterName: DirectoryAnswerFilterName;
  fieldKey: string;
  values: string[];
}

function findField(
  sections: readonly PersonaSection[],
  fieldKey: string,
): PersonaField | undefined {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.key === fieldKey) return field;
    }
  }
  return undefined;
}

/**
 * Turn the requested filters into validated (field key, values) pairs, or throw.
 *
 * VALIDATE THE DOMAIN, NOT THE SHAPE. A filter value of the right TYPE is not
 * thereby a real option: an unknown field key or an unknown option value is a
 * clean 400 here and never reaches a SQL bind, for the same reason
 * `PersonaMetricsField` is resolved from the effective schema before a
 * distribution query runs.
 */
export function resolveAnswerFilters(
  sections: readonly PersonaSection[],
  filters: OpenMemberFilters,
): ResolvedAnswerFilter[] {
  const out: ResolvedAnswerFilter[] = [];

  for (const filterName of DIRECTORY_ANSWER_FILTER_NAMES) {
    const requested = filters[filterName];
    if (requested === undefined) continue;
    const values = [...new Set(requested.map((v) => v.trim()).filter((v) => v !== ''))];
    if (values.length === 0) continue;

    const fieldKey = DIRECTORY_ANSWER_FILTERS[filterName];
    const field = findField(sections, fieldKey);
    if (field === undefined) {
      throw new MemberDirectoryError(
        `This instance has no "${filterName}" field to filter on`,
        { code: 'UNKNOWN_FILTER_FIELD', status: 400, field: filterName },
      );
    }

    // The rows this filter reads live in `user_persona_answers`. A field whose
    // sink moved (sensitive, or analytics: false) has its answers in the
    // free-text table instead, so filtering on it would silently match nobody
    // AND would be reaching into the sink that exists never to be queried in
    // bulk. Refusing says so out loud.
    if (personaFieldSink(field) !== 'answers') {
      throw new MemberDirectoryError(
        `"${filterName}" is not a filterable field on this instance`,
        { code: 'FIELD_NOT_FILTERABLE', status: 400, field: filterName },
      );
    }

    if (personaFieldSpec(field.type).supportsOptions) {
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      for (const value of values) {
        if (!allowed.has(value)) {
          throw new MemberDirectoryError(
            `"${value}" is not an option of "${filterName}"`,
            { code: 'UNKNOWN_FILTER_VALUE', status: 400, field: filterName },
          );
        }
      }
    }

    out.push({ filterName, fieldKey, values });
  }

  return out;
}

/** Validate `hasLink` against the effective platform list. Unknown platform is a 400. */
export function resolveLinkFilters(
  platforms: readonly PersonaLinkPlatformSpec[],
  filters: OpenMemberFilters,
): string[] {
  const requested = filters.hasLink;
  if (requested === undefined) return [];
  const keys = [...new Set(requested.map((v) => v.trim()).filter((v) => v !== ''))];
  const known = new Set(platforms.map((p) => p.key));
  for (const key of keys) {
    if (!known.has(key)) {
      throw new MemberDirectoryError(
        `"${key}" is not a link platform on this instance`,
        { code: 'UNKNOWN_LINK_PLATFORM', status: 400, field: 'hasLink' },
      );
    }
  }
  return keys;
}

/**
 * Escape the LIKE metacharacters so a `%` in a search term matches a literal `%`.
 *
 * Byte-identical to the escaping in `layers/base/server/api/public/v1/users/
 * index.get.ts`, deliberately: `q` on this endpoint has to mean exactly what `q`
 * means on the endpoint it is the consent-gated sibling of, or a recipient
 * comparing the two sees rows appear and disappear for no reason they can see.
 */
function likePattern(term: string): string {
  return `%${term.replace(/[%_]/g, (c) => `\\${c}`)}%`;
}

// --- The consent join -------------------------------------------------------------

/**
 * THE consent join condition. There is no code path in this module that reads
 * members without it.
 *
 * Same shape and the same reasoning as the aggregate join: an INNER JOIN, never
 * a post-filter and never a WHERE helper, with the digest bound IN the join
 * condition. A non-consenting member has no row to join to; a member whose grant
 * predates a recipient being added has a digest that matches nothing. Adding a
 * recipient therefore drops every stale grant out of the directory at once, with
 * no migration and no backfill.
 *
 * `uq_purpose_current` (partial unique on `superseded_at IS NULL`) guarantees at
 * most one current row per (user, purpose), so the join cannot multiply a member
 * across rows and disclose them twice in one page.
 */
function currentDirectoryGrant(
  consents: ReturnType<typeof alias<typeof userPurposeConsents, string>>,
  purpose: ProcessingPurposeId,
  scopeDigest: string,
): SQL | undefined {
  return and(
    eq(consents.userId, users.id),
    eq(consents.purpose, purpose),
    eq(consents.state, 'granted'),
    isNull(consents.supersededAt),
    eq(consents.scopeDigest, scopeDigest),
  );
}

/**
 * The only definition of "a member who may be listed", beyond the grant.
 *
 * `profile_visibility = 'public'` is disclosed in the recruiter copy ("what is
 * already on your public profile"), and it is the same predicate the aggregate
 * pipeline and the public users endpoint apply. A member who grants the purpose
 * and later goes private leaves the directory without revoking anything.
 */
function listableUserWhere(): SQL | undefined {
  return and(
    isNull(users.deletedAt),
    eq(users.status, 'active'),
    eq(users.profileVisibility, 'public'),
  );
}

/** The public columns, exactly the set `toPublicUser` consumes. Never a `select()`. */
const DIRECTORY_USER_FIELDS = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  headline: users.headline,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  bannerUrl: users.bannerUrl,
  pronouns: users.pronouns,
  location: users.location,
  website: users.website,
  skills: users.skills,
  socialLinks: users.socialLinks,
  profileVisibility: users.profileVisibility,
  createdAt: users.createdAt,
  deletedAt: users.deletedAt,
} as const;

/** Every filter, as one AND-ed predicate list. Answer filters are EXISTS subqueries. */
function filterConditions(
  answerFilters: readonly ResolvedAnswerFilter[],
  linkFilters: readonly string[],
  filters: OpenMemberFilters,
): SQL[] {
  const conds: SQL[] = [];
  const qb = new QueryBuilder();

  answerFilters.forEach((filter, i) => {
    // One alias per subquery: two EXISTS clauses over the same table in one
    // statement are independent scopes, and naming them makes the generated SQL
    // readable when somebody EXPLAINs a slow directory page.
    const answers = alias(userPersonaAnswers, `pa_${i}`);
    conds.push(
      exists(
        qb
          .select({ one: sql`1` })
          .from(answers)
          .where(
            and(
              eq(answers.userId, users.id),
              eq(answers.fieldKey, filter.fieldKey),
              // OR within one field: any of the requested options qualifies.
              inArray(answers.value, filter.values),
            ),
          ),
      ),
    );
  });

  for (const platform of linkFilters) {
    // `jsonb_typeof(...) = 'object'` is not optional: `->>` on a legacy row
    // holding a non-object jsonb value is not an error but is not a lookup
    // either, and the guard states the assumption. The key is a bound parameter
    // with an explicit cast, because `jsonb ->> $1` alone is an ambiguous
    // operator (text vs integer subscript) that Postgres refuses to resolve.
    // Parenthesised as one term. A raw fragment carrying its own `AND` is
    // spliced into whatever combinator holds it, so the parens are what keep it
    // a single predicate if this list ever ends up inside an `or()`.
    //
    // THE `user_shared_links` LEG IS NOT OPTIONAL EITHER, and it is the half a
    // reader is most likely to think belongs only in the projection. Filtering
    // on a link the payload then withholds still answers the question: a
    // recruiter who searches `hasLink=github` and gets a member back has learned
    // that member has a GitHub, which is precisely the fact the member declined
    // to share. A filter is a disclosure with one bit of resolution. So the
    // filter and the projection read the same table, and a platform a member
    // does not share can neither be seen nor be searched for.
    conds.push(
      sql`(jsonb_typeof(${users.socialLinks}) = 'object'
        AND coalesce(${users.socialLinks} ->> ${platform}::text, '') <> ''
        AND EXISTS (
          SELECT 1 FROM ${userSharedLinks}
          WHERE ${userSharedLinks.userId} = ${users.id}
            AND ${userSharedLinks.platform} = ${platform}::text
        ))`,
    );
  }

  const location = filters.location?.trim();
  if (location !== undefined && location !== '') {
    if (location.length > DIRECTORY_LOCATION_MAX_LENGTH) {
      throw new MemberDirectoryError('location is too long', {
        code: 'FILTER_TOO_LONG',
        status: 400,
        field: 'location',
      });
    }
    conds.push(ilike(users.location, likePattern(location)));
  }

  const q = filters.q?.trim();
  if (q !== undefined && q !== '') {
    if (q.length > DIRECTORY_Q_MAX_LENGTH) {
      throw new MemberDirectoryError('q is too long', {
        code: 'FILTER_TOO_LONG',
        status: 400,
        field: 'q',
      });
    }
    const pattern = likePattern(q);
    const search = or(ilike(users.username, pattern), ilike(users.displayName, pattern));
    if (search !== undefined) conds.push(search);
  }

  return conds;
}

// --- Projection -------------------------------------------------------------------

/** A field this surface may publish, with its vocabulary already resolved. */
interface ProjectableField {
  fieldKey: string;
  label: string;
  sink: 'answers' | 'text';
  /** Whether the type carries a closed vocabulary at all (a checkbox does not). */
  hasOptions: boolean;
  labels: Map<string, string>;
}

/**
 * Which persona fields this response may carry, in schema order.
 *
 * - `sensitive` fields are never published, whatever their sink. Derived from
 *   the FLAG and never from the sink, because `personaFieldSink` also routes an
 *   `analytics: false` field to `text` and an operator who turned counting off
 *   did not thereby mark the field special.
 * - `column:`-bound fields are skipped: display name, headline, location,
 *   pronouns and bio are already on the `toPublicUser` payload, and repeating
 *   them would send each one twice.
 * - `link` fields are skipped for the same reason: their storage IS
 *   `users.social_links`, which `toPublicUser` already carries, per platform and
 *   per the member's sharing choice.
 * - Drifted keys are skipped, so no value is printed under a question that has
 *   since changed meaning.
 *
 * THERE IS NO `showOnProfile` GATE HERE, and its absence is the decision rather
 * than an omission. The rule used to be "anything the public profile refuses to
 * print, this refuses to send", which made sense while the copy read "what is
 * already on your public profile" and while answers were public by default.
 * Both halves of that changed at once. Answers are private unless an operator
 * opts a field in, and `recruiter_visibility`'s copy no longer points at the
 * profile: it says the member's "answers about interests and tech stack are
 * shown to the people named below". Carrying the profile gate across would make
 * this endpoint list consenting members with no answers at all on a default
 * instance, which turns `persona_selections` in that purpose's `covers` into a
 * claim about nothing, and it would leave the ANSWER FILTERS matching on fields
 * the payload never prints, which is the worse half: matching on hidden data
 * while claiming not to publish it. Publication on a profile and disclosure to a
 * named recipient are different questions with different instruments, and this
 * one is answered by the grant.
 *
 * `sensitive` is the line that does not move. It is never published anywhere,
 * by any consent, which is why it is a separate flag from visibility.
 */
export function directoryProjectableFields(
  sections: readonly PersonaSection[],
  driftedFieldKeys: readonly string[] = [],
): ProjectableField[] {
  const drifted = new Set(driftedFieldKeys);
  const out: ProjectableField[] = [];

  for (const section of sections) {
    for (const field of section.fields) {
      if (field.column !== undefined) continue;
      if (field.sensitive === true) continue;
      if (drifted.has(field.key)) continue;

      const sink = personaFieldSink(field);
      if (sink !== 'answers' && sink !== 'text') continue;

      out.push({
        fieldKey: field.key,
        label: field.label,
        sink,
        hasOptions: personaFieldSpec(field.type).supportsOptions,
        labels: new Map((field.options ?? []).map((o) => [o.value, o.label])),
      });
    }
  }

  return out;
}

/** Load and project the publishable persona answers for one page of members. */
async function loadPersonaAnswers(
  tx: DB,
  userIds: readonly string[],
  fields: readonly ProjectableField[],
): Promise<Map<string, OpenMemberAnswer[]>> {
  const out = new Map<string, OpenMemberAnswer[]>();
  if (userIds.length === 0 || fields.length === 0) return out;

  const answerKeys = fields.filter((f) => f.sink === 'answers').map((f) => f.fieldKey);
  const textKeys = fields.filter((f) => f.sink === 'text').map((f) => f.fieldKey);

  // `inArray` with an empty list is `IN ()`, which is not valid SQL, so each
  // read is guarded rather than relying on the caller never asking for none.
  const [answerRows, textRows] = await Promise.all([
    answerKeys.length === 0
      ? Promise.resolve([])
      : tx
        .select({
          userId: userPersonaAnswers.userId,
          fieldKey: userPersonaAnswers.fieldKey,
          value: userPersonaAnswers.value,
        })
        .from(userPersonaAnswers)
        .where(
          and(
            inArray(userPersonaAnswers.userId, [...userIds]),
            inArray(userPersonaAnswers.fieldKey, answerKeys),
          ),
        )
        .orderBy(userPersonaAnswers.fieldKey, userPersonaAnswers.value),
    textKeys.length === 0
      ? Promise.resolve([])
      : tx
        .select({
          userId: userPersonaText.userId,
          fieldKey: userPersonaText.fieldKey,
          value: userPersonaText.value,
        })
        .from(userPersonaText)
        .where(
          and(
            inArray(userPersonaText.userId, [...userIds]),
            inArray(userPersonaText.fieldKey, textKeys),
          ),
        ),
  ]);

  const answersByUser = new Map<string, Map<string, string[]>>();
  for (const row of answerRows) {
    const byField = answersByUser.get(row.userId) ?? new Map<string, string[]>();
    byField.set(row.fieldKey, [...(byField.get(row.fieldKey) ?? []), row.value]);
    answersByUser.set(row.userId, byField);
  }
  const textByUser = new Map<string, Map<string, string>>();
  for (const row of textRows) {
    const byField = textByUser.get(row.userId) ?? new Map<string, string>();
    byField.set(row.fieldKey, row.value);
    textByUser.set(row.userId, byField);
  }

  for (const userId of userIds) {
    const projected: OpenMemberAnswer[] = [];
    for (const field of fields) {
      if (field.sink === 'text') {
        const value = textByUser.get(userId)?.get(field.fieldKey);
        if (value === undefined || value.trim() === '') continue;
        projected.push({
          fieldKey: field.fieldKey,
          label: field.label,
          display: 'text',
          values: [value],
        });
        continue;
      }

      const stored = answersByUser.get(userId)?.get(field.fieldKey);
      if (stored === undefined || stored.length === 0) continue;
      if (!field.hasOptions) {
        // A checkbox has no vocabulary: its one stored value means "ticked", so
        // the field label carries the meaning.
        projected.push({
          fieldKey: field.fieldKey,
          label: field.label,
          display: 'chips',
          values: ['Yes'],
        });
        continue;
      }
      // A stored value the field no longer offers is DROPPED rather than
      // published raw: `missing_option` drift must not put `pcb_design` on the
      // wire as if it were a label.
      const values = stored.flatMap((v) => {
        const label = field.labels.get(v);
        return label === undefined ? [] : [label];
      });
      if (values.length === 0) continue;
      projected.push({
        fieldKey: field.fieldKey,
        label: field.label,
        display: 'chips',
        values,
      });
    }
    if (projected.length > 0) out.set(userId, projected);
  }

  return out;
}

// --- Per-platform link sharing ------------------------------------------------------

/**
 * Which link platforms each member on this page has chosen to share.
 *
 * ROW PRESENT MEANS SHARED (plan R3.1 D6). A member who has never opened the
 * control has no rows and therefore shares nothing, so the default is off by
 * construction rather than by a default value a later migration could flip. A
 * member with a GitHub row and no Instagram row shares one and not the other,
 * which is the whole point: "share my links" as a single switch forces a person
 * to hand over a personal account to hand over a portfolio.
 *
 * One query for the page, keyed by user, for the same reason
 * {@link loadPersonaAnswers} is: a per-row lookup inside the projection is N+1
 * queries inside the transaction that is already holding the disclosure write.
 */
async function loadSharedLinkPlatforms(
  tx: DB,
  userIds: readonly string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  // `inArray` with an empty list is `IN ()`, which is not valid SQL.
  if (userIds.length === 0) return out;

  const rows = await tx
    .select({ userId: userSharedLinks.userId, platform: userSharedLinks.platform })
    .from(userSharedLinks)
    .where(inArray(userSharedLinks.userId, [...userIds]));

  for (const row of rows) {
    const set = out.get(row.userId) ?? new Set<string>();
    set.add(row.platform);
    out.set(row.userId, set);
  }
  return out;
}

/**
 * Keep only the platforms this member shares.
 *
 * An ALLOW-LIST built from the member's own rows, not a filter that removes the
 * ones they refused: a platform absent from `user_shared_links` is absent from
 * the payload whether or not anybody remembered it exists, so an operator adding
 * a platform tomorrow does not silently disclose it for every member who
 * consented today.
 *
 * Returns `null` rather than `{}` when nothing is shared, matching what
 * `toPublicUser` produces for a member with no links at all: a recipient cannot
 * tell "shares nothing" from "has nothing", which is the correct amount to say.
 */
function sharedSocialLinks(
  socialLinks: Record<string, string | undefined> | null,
  shared: ReadonlySet<string> | undefined,
): Record<string, string | undefined> | null {
  if (socialLinks === null || shared === undefined || shared.size === 0) return null;
  const out: Record<string, string> = {};
  for (const [platform, url] of Object.entries(socialLinks)) {
    if (!shared.has(platform)) continue;
    if (typeof url !== 'string' || url === '') continue;
    out[platform] = url;
  }
  return Object.keys(out).length === 0 ? null : out;
}

// --- The disclosure audit ---------------------------------------------------------

export interface RecordDisclosuresInput {
  /** The named recipient, already resolved from the key's binding by the caller. */
  recipientId: string;
  apiKeyId?: string | null;
  /** The members disclosed by this response. One row each, in order. */
  userIds: readonly string[];
  purpose: ProcessingPurposeId;
  /** The digest the grant carried, so an audit can prove consent was current. */
  scopeDigest: string;
}

/**
 * Write one `disclosure_events` row per member in the response.
 *
 * TAKES A TRANSACTION, and the only caller passes the one that did the read.
 * Split into its own connection, a crash between the read and the write ships a
 * page nobody recorded, and the member's "who has looked at you" list is then
 * quietly incomplete forever. Inside the read's transaction, a failed insert
 * rolls the whole request back and the recipient gets an error instead of an
 * unlogged disclosure, which is the direction to fail in.
 *
 * NO UPSERT and no dedup. `disclosure_events` is deliberately not unique on
 * (recipient, user): a repeat pull is a repeat disclosure, and the COUNT is the
 * signal that makes bulk extraction visible on the operator panel.
 */
export async function recordDisclosures(
  tx: DB,
  input: RecordDisclosuresInput,
): Promise<number> {
  if (input.userIds.length === 0) return 0;

  await tx.insert(disclosureEvents).values(
    input.userIds.map((userId) => ({
      recipientId: input.recipientId,
      apiKeyId: input.apiKeyId ?? null,
      userId,
      purpose: input.purpose,
      scopeDigest: input.scopeDigest,
    })),
  );

  return input.userIds.length;
}

// --- The listing ------------------------------------------------------------------

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DIRECTORY_LIMIT_DEFAULT;
  return Math.min(DIRECTORY_LIMIT_MAX, Math.max(1, Math.floor(limit)));
}

function clampOffset(offset: number | undefined): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset));
}

/**
 * One page of members who currently consent to being listed to this audience,
 * with every one of them logged as disclosed before the page is returned.
 *
 * ORDERING ends with `users.id`, a unique tiebreaker. `created_at` alone is not
 * a total order (a seeded instance and a bulk import both produce ties), and an
 * offset page over a non-deterministic order repeats and skips rows silently,
 * which on this surface means disclosing somebody twice and somebody else never.
 *
 * NOT k-anonymised, including the total. See D1 at the top of this file: these
 * are consenting, identified people, and a count of a set the caller is
 * authorised to enumerate one by one reveals nothing the page does not.
 */
export async function listOpenMembers(
  db: DB,
  input: ListOpenMembersInput,
): Promise<OpenMembersPage> {
  const purpose = directoryPurpose(input.audience);

  // The class gate, before any query runs. A purpose whose registry entry does
  // not cover `public_identity` cannot back a listing of identified people, and
  // saying so here means no route can enable the audience by forgetting to ask.
  if (!purposeCovers(purpose, DIRECTORY_IDENTITY_CLASS)) {
    throw new MemberDirectoryError(
      `"${PROCESSING_PURPOSE_SPECS[purpose].label}" does not cover disclosing who somebody is, `
      + 'so it cannot list members. This needs a covers and copy change on the purpose itself.',
      { code: 'PURPOSE_DOES_NOT_COVER_IDENTITY', status: 404 },
    );
  }

  const scope = disclosureScope(purpose);
  const filters = input.filters ?? {};
  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);

  // Validation first, and outside the transaction: an unknown filter key is a
  // client error that must never open a transaction, let alone reach a bind.
  const answerFilters = resolveAnswerFilters(input.sections, filters);
  const linkFilters = resolveLinkFilters(input.linkPlatforms, filters);
  const conds = [listableUserWhere(), ...filterConditions(answerFilters, linkFilters, filters)];

  const projectable = scope.answers
    ? directoryProjectableFields(input.sections, input.driftedFieldKeys)
    : [];

  return await db.transaction(async (tx) => {
    const consents = alias(userPurposeConsents, 'cdir');
    const grant = currentDirectoryGrant(consents, purpose, input.scopeDigest);

    const rows = await tx
      .select(DIRECTORY_USER_FIELDS)
      .from(users)
      .innerJoin(consents, grant)
      .where(and(...conds))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit)
      .offset(offset);

    const countConsents = alias(userPurposeConsents, 'cdircount');
    const [totalRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(countConsents, currentDirectoryGrant(countConsents, purpose, input.scopeDigest))
      .where(and(...conds));

    const userIds = rows.map((r) => r.id);
    const [personaByUser, sharedByUser] = await Promise.all([
      loadPersonaAnswers(tx, userIds, projectable),
      // Loaded even when `scope.links` is false, and thrown away in that case:
      // one query on a page of at most 50 rows is not worth a branch that a
      // later edit could invert. The gate below is what decides.
      loadSharedLinkPlatforms(tx, userIds),
    ]);

    // BEFORE the payload is built, in this transaction. A throw here rolls the
    // read back and the recipient is told the request failed (D3).
    const disclosed = await recordDisclosures(tx, {
      recipientId: input.recipientId,
      apiKeyId: input.apiKeyId ?? null,
      userIds,
      purpose,
      scopeDigest: input.scopeDigest,
    });

    const items: OpenMember[] = rows.map((row) => {
      const publicUser = toPublicUser(row as PublicUserRow);
      return {
        ...publicUser,
        // Per-class gates, derived from the purpose's own `covers`, so a payload
        // cannot outrun the sentence the member read. Every class is covered by
        // `recruiter_visibility` today, so no class is dropped; the gates exist
        // so narrowing the copy narrows the payload in the same commit. The
        // link class then passes through a SECOND, per-member gate, because
        // `covers` says what the purpose may disclose and `user_shared_links`
        // says what this member agreed to hand over one platform at a time.
        location: scope.location ? publicUser.location : null,
        // `website` is a `users` column and not a link PLATFORM, so it has no
        // row in `user_shared_links` to consult and stays on the class gate
        // alone. Flagged rather than quietly decided: a member who withholds
        // every platform still hands over their website here, and if that is
        // wrong the fix is a platform key for it, not a special case in this
        // expression.
        website: scope.links ? publicUser.website : null,
        socialLinks: scope.links
          ? sharedSocialLinks(publicUser.socialLinks, sharedByUser.get(row.id))
          : null,
        persona: personaByUser.get(row.id) ?? [],
      };
    });

    const total = totalRow?.count ?? 0;
    return {
      items,
      ...toPageMeta({ total, returned: rows.length, limit, offset }),
      limit,
      offset,
      disclosed,
    };
  });
}

// --- "Who has looked at you" ------------------------------------------------------

export interface MemberDisclosureSummary {
  recipientId: string;
  purpose: string;
  /** How many times, not when each one was: the count is the useful signal. */
  count: number;
  lastDisclosedAt: Date;
}

/**
 * What one member sees on `/settings/privacy` (D6).
 *
 * The accountability record is worth more to the member than to the operator,
 * and it is the honest counterpart to D5: turning the toggle off removes you
 * from the next response and cannot recall what was already shared. The copy on
 * that page must say so, and must not be softened.
 *
 * Grouped per recipient rather than listing every row, because a recruiter who
 * pages through the directory four times a day would otherwise bury the one
 * fact the member wants (who, and how recently).
 */
export async function listDisclosuresForMember(
  db: DB,
  userId: string,
): Promise<MemberDisclosureSummary[]> {
  const rows = await db
    .select({
      recipientId: disclosureEvents.recipientId,
      purpose: disclosureEvents.purpose,
      count: sql<number>`count(*)::int`,
      lastDisclosedAt: sql<Date>`max(${disclosureEvents.disclosedAt})`,
    })
    .from(disclosureEvents)
    .where(eq(disclosureEvents.userId, userId))
    .groupBy(disclosureEvents.recipientId, disclosureEvents.purpose)
    .orderBy(desc(sql`max(${disclosureEvents.disclosedAt})`), disclosureEvents.recipientId);

  return rows.map((r) => ({
    recipientId: r.recipientId,
    purpose: r.purpose,
    count: Number(r.count),
    lastDisclosedAt: new Date(r.lastDisclosedAt),
  }));
}
