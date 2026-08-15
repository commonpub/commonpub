import { effectivePersonaSchema, getPersonaValues, personaAnswerMap } from '@commonpub/server';
/**
 * The dismissal cookie name and the "offer twice, then stop" threshold come from
 * `@commonpub/persona`, which `layers/base/package.json` declares.
 *
 * They are IMPORTED, not copied. Three surfaces speak them and none can import
 * the others: the banner writes the cookie, this route reads it, and
 * `BUILTIN_COOKIES` discloses it. A hand-copied cookie name that drifts does not
 * fail loudly, it just stops remembering the refusal and the banner returns
 * forever, which is the exact nag the design exists to prevent.
 */
import {
  PERSONA_INVITE_DISMISSED_COOKIE,
  PERSONA_INVITE_MAX_DISMISSALS,
  personaCompleteness,
} from '@commonpub/persona';

/**
 * GET /api/persona/status — everything the dashboard invitation banner needs,
 * decided by the SERVER (plan 8.4), mirroring `/api/consent/status`.
 *
 * No client-side inference, for the reason 8.4 gives: `ClientAuthUser` carries no
 * profile fields at all, so a client cannot know whether this user has answered
 * anything without asking. It also means the "offer twice then stop" threshold
 * lives in exactly one place.
 *
 * This route is NOT `requireFeature`-gated, and that is deliberate. The banner
 * asks one question, "should I offer this?", and a 404 is a worse answer than
 * `enabled: false` because it is indistinguishable from a routing bug. Every
 * route that reads or writes persona DATA is gated; this one reads a decision.
 */
export interface PersonaStatusResponse {
  /** Is the persona feature switched on for this instance at all? */
  enabled: boolean;
  /**
   * THE decision. `enabled && !hasAnyAnswer && dismissals < 2`, computed here so
   * the threshold is not re-derived per surface.
   */
  offer: boolean;
  /**
   * Has the viewer answered at least one question in the CURRENTLY OFFERED
   * persona schema, or left data behind under a question that has since been
   * removed?
   *
   * Deliberately counts only the persona-owned sinks (`user_persona_answers`,
   * `user_persona_text`) and the retired block. It does NOT count the fields
   * bound to existing `users` columns or to `social_links`: a display name set
   * during registration is not an answer to a persona question, and counting it
   * would make this true for very nearly every account, which would suppress the
   * invitation universally and turn the banner into dead code.
   */
  hasAnyAnswer: boolean;
  /**
   * The editor's meter (plan 8.3), which asks a DIFFERENT question from
   * `hasAnyAnswer`: how much of the offered profile is filled in. Column-bound
   * and link fields DO count here, because the profile is section one of the
   * persona and a filled display name is a filled field.
   */
  completeness: { filled: number; total: number };
  /** How many times this viewer has dismissed the invitation, from the cookie. */
  dismissals: number;
}

/** Parse the dismissal cookie into a count. Anything unparseable is zero. */
function readDismissals(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Clamp: the cookie is client-writable, so a hostile or corrupted value must
  // not become an unbounded number in the payload.
  return Math.min(n, PERSONA_INVITE_MAX_DISMISSALS);
}

export default defineEventHandler(async (event): Promise<PersonaStatusResponse> => {
  const user = requireAuth(event);
  const config = useConfig();
  const dismissals = readDismissals(getCookie(event, PERSONA_INVITE_DISMISSED_COOKIE));

  if (config.features.persona !== true) {
    // With the feature off there is no effective persona schema, so there is
    // nothing offered, nothing to have answered and nothing to fill. These are
    // statements about the OFFER, not counts of stored rows: a user may well
    // have persona rows from when the flag was on, and this payload does not
    // claim otherwise. Nothing may read `filled`/`total` as a row count.
    return {
      enabled: false,
      offer: false,
      hasAnyAnswer: false,
      completeness: { filled: 0, total: 0 },
      dismissals,
    };
  }

  const db = useDB();
  const { sections } = await effectivePersonaSchema(db, config);
  const values = await getPersonaValues(db, user.id, sections);
  const completeness = personaCompleteness(sections, personaAnswerMap(sections, values));

  const hasAnyAnswer =
    Object.keys(values.answers).length > 0 ||
    Object.keys(values.text).length > 0 ||
    values.retired.length > 0;

  return {
    enabled: true,
    offer: !hasAnyAnswer && dismissals < PERSONA_INVITE_MAX_DISMISSALS,
    hasAnyAnswer,
    completeness: { filled: completeness.filledFields, total: completeness.totalFields },
    dismissals,
  };
});
