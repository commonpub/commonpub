import { effectivePersonaSchema, getPersonaValues, personaAnswerMap } from '@commonpub/server';
import type { PersonaValues, RetiredPersonaValues } from '@commonpub/server';
// `@commonpub/persona` is the pure brain (plan 14.3) and IS declared in
// `layers/base/package.json`, pinned from the other side by
// `server/api/consent/__tests__/purposes-contract.test.ts`. The layer depends on
// it because Vue components cannot reach a Node-only package and several of them
// need `personaCompleteness`, `personaFieldSpec` and the types. Only the persona
// ADMIN routes take their persona surface exclusively through
// `@commonpub/server`; see the note in `admin/persona/schema.put.ts`.
import { personaCompleteness } from '@commonpub/persona';
import type { PersonaCompleteness, PersonaSection } from '@commonpub/persona';

/**
 * GET /api/persona — the effective persona schema, the VIEWER'S OWN answers, and
 * the retired block (plan sections 4.5, 4.6 and 8.1).
 *
 * Own data only. There is no `?userId` and no username param: this route is the
 * editor's read side, and the public profile reads through the profile surface
 * with its own visibility rules. `requireAuth` therefore fully scopes the read.
 *
 * The `drift` and `source` fields of the resolved schema are DELIBERATELY not
 * returned. They are operator information (which of the config file, the DB
 * override or the built-ins is in force, and where user data contradicts it) and
 * belong to the admin schema route, not to a member's editor payload.
 *
 * The `retired` block is lifted to the top level rather than left nested inside
 * `values`, because it is the one part of this payload that has its own UI
 * section and its own delete control: data collected under a question that is no
 * longer asked, which the user must still be able to see and erase (Art. 15,
 * Art. 17). See `DELETE /api/persona/retired/[fieldKey]`.
 */
export interface PersonaReadResponse {
  /** The effective schema, in render order. */
  sections: PersonaSection[];
  /**
   * The viewer's stored values, partitioned exactly as they are stored:
   * `answers` (closed vocabulary), `text` (free text), `links` (profile links)
   * and `columns` (fields bound to an existing `users` column).
   */
  values: Omit<PersonaValues, 'retired'>;
  /** Values whose field is no longer in the schema. Never empty-hidden. */
  retired: RetiredPersonaValues[];
  /** Whole-persona and per-section completeness, for the editor's meter (8.3). */
  completeness: PersonaCompleteness;
}

export default defineEventHandler(async (event): Promise<PersonaReadResponse> => {
  requireFeature('persona');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const { sections } = await effectivePersonaSchema(db, config);
  const values = await getPersonaValues(db, user.id, sections);
  const { retired, ...stored } = values;

  return {
    sections,
    values: stored,
    retired,
    completeness: personaCompleteness(sections, personaAnswerMap(sections, values)),
  };
});
