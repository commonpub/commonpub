import { and, eq, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { effectivePersonaSchema, getPersonaValues } from '@commonpub/server';
import type { PersonaField } from '@commonpub/persona';
import { personaFieldSink, personaFieldSpec } from '@commonpub/persona';

/**
 * GET /api/users/:username/persona — one member's persona answers, as they chose
 * to show them (plan section 8.5).
 *
 * WHY A DEDICATED ROUTE, not a wider `UserProfile`. `getUserByUsername` feeds
 * three surfaces at once: this profile page, the public API serializer
 * `toPublicUser`, and the federation actor document. A persona field added to
 * that DTO would be disclosed to all three the moment it was added, and plan
 * section 14 keeps it untouched deliberately. A sibling route (the same shape as
 * `content.get.ts` and `learning.get.ts`) keeps persona behind its own flag,
 * its own visibility check and its own failure mode: this endpoint 404ing does
 * not take the profile page down with it.
 *
 * CONSENT IS NOT A GATE HERE, AND MUST NOT BECOME ONE. `profile_analytics` and
 * the other purposes in `@commonpub/persona`'s registry govern AGGREGATION:
 * whether an answer may be counted into a cohort alongside other people's.
 * Showing your own answers on your own profile is what filling them in was FOR,
 * and it is the member's own `publicOnProfile` decision (via the operator's
 * schema) that governs it. Joining `user_purpose_consents` here would mean a
 * member who refuses statistics also loses their own profile, which is consent
 * under duress and precisely what the offer/refuse copy promises does not
 * happen. A later reader who sees an uncounted field rendering here is looking
 * at the design, not at a missing join.
 *
 * WHAT IS DELIBERATELY NOT RETURNED:
 * - `sensitive` fields (the Art. 9 escape hatch). Never derived from the sink:
 *   `personaFieldSink` also routes an `analytics: false` field to `text`, and an
 *   operator who turned counting off did not thereby mark the field special.
 * - `publicOnProfile === false` fields. This route is the reader that makes that
 *   operator control mean something.
 * - `column:`-bound fields (display name, headline, location, pronouns, bio).
 *   They are already rendered by the profile hero and its Details block;
 *   repeating them here would print each one twice.
 * - `link` fields, for the SAME reason and no other. A persona `link` field is
 *   not persona-owned storage: `personaFieldSink` routes it to `users.social_links`,
 *   the same jsonb column `/settings/profile` writes and the profile hero has
 *   rendered as its icon row since long before this feature existed
 *   (`pages/u/[username]/index.vue`, the `.cpub-profile-social` row). Returning
 *   them here prints GitHub, X, LinkedIn, YouTube and Mastodon TWICE on one page
 *   — and it does so for every member who never opened `/settings/persona`,
 *   because their existing profile links are already in that column. Turning the
 *   flag on must not visibly duplicate data nobody re-entered.
 *
 *   The alternative (delete the hero row, let this be the only link surface) was
 *   rejected: `persona` defaults to `false`, so it would strip the icons from
 *   every instance that never enables this feature, to fix a collision only
 *   instances that DO enable it can have. The new surface yields to the live one.
 *
 *   WHAT THIS COSTS, stated rather than hidden: an operator-declared eighth link
 *   platform renders on no public surface, because the hero's five are
 *   hardcoded. That is not a regression — it was already true — and it is the
 *   deferred `user_profile_links` work in plan 14.4 ("operator-extensible
 *   platforms arrive with the table, later, behind its own flag"), not something
 *   this route can fix alone. Link fields still collect, still appear in the
 *   member's own editor, still export under Art. 15 and still feed
 *   `/metrics/persona/links`.
 * - Retired keys. `getPersonaValues` partitions them into `values.retired`,
 *   which this file never reads: the question no longer exists, the stored
 *   values have no labels left to resolve, and the member's own editor is the
 *   place that surface belongs (Art. 15/17).
 * - Drifted keys, where the schema and the stored rows disagree about type or
 *   sink. Printing a value under a question that has since changed meaning
 *   misdescribes the person. `missing_option` drift needs no key-level skip:
 *   the label resolution below drops any stored value the field no longer
 *   offers, which is the same rule applied per value.
 * - Field and section `help`. That copy explains how to ANSWER a question and
 *   is written for the editor, not for a visitor reading the answer.
 */

/**
 * How the client should render this field. Resolved here so the page does no
 * schema work.
 *
 * There is deliberately no `'link'` member. Link fields are excluded above, and
 * a display mode no producer can emit is a dead branch that reads as a shipped
 * capability. Re-adding links means re-adding this member and a `href`, at which
 * point the renderer needs `safeHref` again because `users.social_links` holds
 * rows written before the current URL validators.
 */
export type PublicPersonaDisplay = 'chips' | 'text';

export interface PublicPersonaField {
  key: string;
  label: string;
  display: PublicPersonaDisplay;
  /**
   * Resolved option LABELS for a closed vocabulary, the stored string for free
   * text. Never a raw machine key: a value with no matching option is dropped
   * rather than printed as `pcb_design`.
   */
  values: string[];
}

export interface PublicPersonaSection {
  key: string;
  label: string;
  fields: PublicPersonaField[];
}

export interface PublicPersonaResponse {
  /** Schema order, and only sections that ended up with something to show. */
  sections: PublicPersonaSection[];
  /** True when the viewer is the person whose profile this is. Drives the one owner-only line. */
  isOwner: boolean;
}

/**
 * Domain validation before the SQL bind. `[username].get.ts` next door takes the
 * param as a `string`, which only proves it is non-empty; the column is
 * `varchar(64)` over this alphabet, so anything outside it can match no row and
 * has no business reaching a bind or a query log.
 *
 * Deliberately NOT `usernameSchema`, whose `min(3)` is a SIGNUP rule: a shorter
 * legacy row must still be readable through its own profile.
 */
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** The one 404. Absent, deleted, suspended and not-visible-to-you are all the same answer. */
function notFound(): never {
  throw createError({ statusCode: 404, statusMessage: 'User not found' });
}

/**
 * Values a field's sink can hold, flattened to the display strings for that
 * field. Returns `null` for anything with nothing to show, and for the `links`
 * sink, which this surface does not render (see the header).
 */
function displayValues(
  field: PersonaField,
  answers: readonly string[] | undefined,
  text: string | undefined,
): { display: PublicPersonaDisplay; values: string[] } | null {
  const sink = personaFieldSink(field);

  if (sink === 'answers') {
    if (answers === undefined || answers.length === 0) return null;
    const spec = personaFieldSpec(field.type);
    if (!spec.supportsOptions) {
      // A checkbox has no vocabulary: its one bucket is "this person ticked it",
      // so the field LABEL carries the meaning and the value only confirms it.
      return { display: 'chips', values: ['Yes'] };
    }
    const labels = new Map((field.options ?? []).map((o) => [o.value, o.label]));
    const out: string[] = [];
    for (const value of answers) {
      const label = labels.get(value);
      if (label !== undefined) out.push(label);
    }
    return out.length === 0 ? null : { display: 'chips', values: out };
  }

  if (sink === 'text') {
    if (text === undefined || text.trim() === '') return null;
    return { display: 'text', values: [text] };
  }

  // `links` and anything a future sink adds. Deliberately a second refusal
  // rather than a fall-through the eligibility loop above happens to make
  // unreachable: re-adding link display means editing BOTH, which is what a
  // reintroduction actually is, and either one alone still fails closed.
  return null;
}

export default defineEventHandler(async (event): Promise<PublicPersonaResponse> => {
  requireFeature('persona');
  const { username } = parseParams(event, { username: 'string' });
  if (!USERNAME_RE.test(username)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid username format' });
  }

  const db = useDB();
  const config = useConfig();

  // Read the gate columns directly rather than through `getUserByUsername`:
  // that function runs four aggregate queries for counts this route does not
  // use, and it returns neither `status` nor `profile_visibility`, which are
  // exactly the two facts the gate turns on.
  const rows = await db
    .select({
      id: users.id,
      status: users.status,
      profileVisibility: users.profileVisibility,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);

  const target = rows[0];
  if (target === undefined) notFound();

  const viewer = getOptionalUser(event);
  const isOwner = viewer !== null && viewer.id === target.id;

  if (!isOwner) {
    // A suspended account keeps its data and loses its audience.
    if (target.status !== 'active') notFound();
    // Widened to `string` on purpose, so this is an ALLOW-list rather than a
    // deny-list: 'members' is the one visibility that depends on the viewer
    // rather than on the profile alone, and any value the enum does not name
    // (a row written before the enum existed is a varchar in practice) falls
    // through to the 404 instead of defaulting to visible.
    const visibility: string = target.profileVisibility;
    const visible = visibility === 'public' || (visibility === 'members' && viewer !== null);
    if (!visible) notFound();
  }

  const { sections, drift } = await effectivePersonaSchema(db, config);
  const driftedKeys = new Set(
    drift.filter((d) => d.kind !== 'missing_option').map((d) => d.fieldKey),
  );
  const values = await getPersonaValues(db, target.id, sections);

  const out: PublicPersonaSection[] = [];
  for (const section of sections) {
    const fields: PublicPersonaField[] = [];
    for (const field of section.fields) {
      if (field.column !== undefined) continue;
      // Both of these are "the profile already renders this", not a privacy
      // rule: `personaFieldSink` puts a `link` field in `users.social_links`,
      // which the hero's icon row has always printed. See the header.
      if (personaFieldSink(field) === 'links') continue;
      if (field.sensitive === true) continue;
      if (field.publicOnProfile === false) continue;
      if (driftedKeys.has(field.key)) continue;

      const resolved = displayValues(field, values.answers[field.key], values.text[field.key]);
      if (resolved === null) continue;

      fields.push({
        key: field.key,
        label: field.label,
        display: resolved.display,
        values: resolved.values,
      });
    }
    if (fields.length > 0) out.push({ key: section.key, label: section.label, fields });
  }

  return { sections: out, isOwner };
});
