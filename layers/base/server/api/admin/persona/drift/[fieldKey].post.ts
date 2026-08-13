/**
 * POST /api/admin/persona/drift/:fieldKey
 *
 * Acknowledge one field key's drift, with the plan 4.6 decision about its rows:
 * `purge` deletes them, `retain` keeps them and marks the key retired so nothing
 * ever counts it again.
 *
 * Drift is what the reconciler reports when the effective schema and what users
 * actually stored disagree (plan 5.3.1): a key renamed in `commonpub.config.ts`,
 * a type flipped, an option dropped. Until it is acknowledged the field is
 * excluded from `listPersonaAggregatableFields`, so a silent rename cannot
 * quietly drop a cohort to zero while the endpoint keeps answering.
 *
 * ORDER IS LOAD BEARING. The acknowledgement runs FIRST because it is also the
 * existence check: `acknowledgePersonaDrift` refuses a key with no recorded
 * drift, and purging the rows first would erase the very evidence that produced
 * the drift, leaving nothing to acknowledge and a 400 on a request that had
 * already destroyed data.
 */
import {
  acknowledgePersonaDrift,
  purgePersonaField,
  retirePersonaField,
  type PersonaSchemaDrift,
} from '@commonpub/server';
import { z } from 'zod';

const ACTIONS = ['purge', 'retain'] as const;

const bodySchema = z.object({
  action: z.enum(ACTIONS),
});

/**
 * The stored key alphabet, `^[a-z0-9_]+$` capped at 40 (`personaFieldSchema`).
 * `parseParams`'s `'slug'` type rejects the underscore every persona key may
 * carry, so the domain is checked here instead of the shape being waved through.
 */
const FIELD_KEY = /^[a-z0-9_]{1,40}$/;

export interface AdminPersonaDriftResponse {
  fieldKey: string;
  action: (typeof ACTIONS)[number];
  acknowledged: PersonaSchemaDrift[];
  /** Rows deleted by `purge`, or rows kept by `retain`. */
  rows: number;
}

export default defineEventHandler(async (event): Promise<AdminPersonaDriftResponse> => {
  requireFeature('admin');
  requireFeature('persona');
  const admin = requirePermission(event, 'settings.manage');

  const { fieldKey } = parseParams(event, { fieldKey: 'string' });
  if (!FIELD_KEY.test(fieldKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid fieldKey format' });
  }

  const body = await parseBody(event, bodySchema);
  const db = useDB();
  const config = useConfig();
  const ip = getRequestIP(event) ?? null;

  const ack = await acknowledgePersonaDrift(db, config, { fieldKey, adminId: admin.id, ip });
  if (!ack.ok) {
    throw createError({
      statusCode: 404,
      statusMessage: ack.error,
      data: { code: 'PERSONA_DRIFT_NOT_FOUND', fieldKey },
    });
  }

  let rows: number;
  if (body.action === 'purge') {
    ({ deleted: rows } = await purgePersonaField(db, { fieldKey, adminId: admin.id, ip }));
  } else {
    ({ retained: rows } = await retirePersonaField(db, { fieldKey, adminId: admin.id, ip }));
  }

  return { fieldKey, action: body.action, acknowledged: ack.acknowledged, rows };
});
