import { setPersonaSection } from '@commonpub/server';
import type { PersonaValues } from '@commonpub/server';
import { z } from 'zod';

/**
 * PUT /api/persona — write ONE section of the viewer's own persona (plan 4.5).
 *
 * The route is deliberately thin: it authenticates, checks the flag, parses a
 * STRUCTURAL shape, and hands the whole submission to `setPersonaSection`, which
 * owns the effective schema, the unknown-key rejection, the per-field domain
 * validation, the profile bridge and the template-scoped delete, all in one
 * transaction. Nothing here inspects a field, and nothing here decides what a
 * value means. Two writers of persona data would be two chances to disagree
 * about which keys a section owns, and the delete is scoped by exactly that.
 *
 * One section per request, not a whole-document save. A section is the unit the
 * editor saves and the unit the template-scoped delete is scoped to, so a
 * whole-document PUT would make a partial failure ambiguous.
 *
 * `answers` is an OMITTABLE-KEY map on purpose. A key the client leaves out is
 * not "unchanged", it is CLEARED, because the delete downstream is scoped to the
 * section's template rather than to the submitted keys. That is what makes
 * "untick every box" and "empty this text field" actually work; scoping to the
 * payload would make withdrawing an answer impossible (plan 4.5, Appendix B13).
 * `{ sectionKey, answers: {} }` is therefore a valid and meaningful request: it
 * clears the whole section.
 */
const personaSectionWriteSchema = z
  .object({
    // Structural only. Whether this key names a real section is
    // `setPersonaSection`'s decision, made against the effective schema; the
    // regex exists so an arbitrary string never travels further than this line.
    sectionKey: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9_]+$/, 'Section keys are lowercase letters, digits and underscores'),
    // `null` and `''` both mean "cleared"; an array is a multiselect. The value
    // caps here are an envelope, not the semantic bound: the real per-field
    // limits come from the field's own `maxLength` and option vocabulary.
    answers: z.record(
      z.string().min(1).max(40),
      z.union([z.string().max(10_000), z.array(z.string().max(10_000)).max(200), z.null()]),
    ),
  })
  .strict();

export default defineEventHandler(async (event): Promise<{ values: PersonaValues }> => {
  requireFeature('persona');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const { sectionKey, answers } = await parseBody(event, personaSectionWriteSchema);

  const result = await setPersonaSection(db, { userId: user.id, sectionKey, answers, config });

  if (!result.ok) {
    // Same envelope `parseBody` throws on a Zod failure, so a client has ONE
    // error shape to read for this route whether the rejection came from the
    // structural parse or from the schema-aware validation behind it. An
    // unknown section key lands here too: it is a client sending a section this
    // instance does not have, which is a bad request, not a missing document.
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: { [result.fieldKey ?? 'sectionKey']: [result.error] } },
    });
  }

  return { values: result.values };
});
