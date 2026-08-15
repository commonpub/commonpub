import { deletePersonaFieldValue, effectivePersonaSchema, getPersonaValues } from '@commonpub/server';

/**
 * The SHAPE of a persona field key, matching `keySchema` in
 * `@commonpub/persona`'s `schemas.ts`. Shape is the cheap first gate, not the
 * gate that matters: see the domain check below.
 */
const FIELD_KEY_RE = /^[a-z0-9_]{1,40}$/;

/**
 * DELETE /api/persona/retired/[fieldKey] — the user erases their own data for a
 * question that is no longer part of this instance's persona schema (plan 4.6,
 * Art. 17).
 *
 * This is the server side of "This was collected under a question that is no
 * longer part of this profile. You can delete it." A live field is cleared by
 * writing the section instead (`PUT /api/persona` with the key omitted), so this
 * route is scoped to the retired set on purpose: one erasure surface per kind of
 * data, and no way to reach a live field through the retired door.
 *
 * VALIDATE THE DOMAIN, NOT THE SHAPE. A `[fieldKey]` router param is untrusted
 * input that ends up as a SQL bind on `user_persona_answers.field_key` and
 * `user_persona_text.field_key`. The regex above only proves it is a plausible
 * string. The check that matters is that the key is one of THIS VIEWER'S OWN
 * retired keys, resolved from their stored rows against the effective schema, so
 * the value reaching the delete is always a key we just read out of the database
 * for this user. An arbitrary key is refused before any write runs, and the
 * refusal is a 404 rather than a 400 because "you have no data under that key"
 * is a statement about the resource, not about the request.
 */
export default defineEventHandler(async (event): Promise<{ deleted: number }> => {
  requireFeature('persona');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  // `parseParams` covers presence; it has no `fieldKey` param type, so the
  // shape and the domain are checked here.
  const { fieldKey: raw } = parseParams(event, { fieldKey: 'string' });
  // decodeURIComponent throws URIError on a malformed escape (`%zz`), which
  // would surface as a 500. A key that cannot be decoded cannot match anything,
  // so treat it as the bad request it is.
  let fieldKey: string;
  try {
    fieldKey = decodeURIComponent(raw);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid fieldKey format' });
  }
  if (!FIELD_KEY_RE.test(fieldKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid fieldKey format' });
  }

  const { sections } = await effectivePersonaSchema(db, config);
  const values = await getPersonaValues(db, user.id, sections);
  const retired = values.retired.find((entry) => entry.fieldKey === fieldKey);
  if (retired === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'No retired data for that field' });
  }

  return deletePersonaFieldValue(db, { userId: user.id, fieldKey: retired.fieldKey });
});
