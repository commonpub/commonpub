/**
 * PUT /api/consent/objection — record or lift the member's objection to being
 * counted in community statistics (GDPR Art. 21).
 *
 * ONE FIELD IN THE BODY, and deliberately nothing else. There is no purpose id,
 * because statistics are not a purpose in the consent registry; no scope digest,
 * because a digest exists to lapse a grant when the terms move and a refusal must
 * survive exactly that; and no snapshot, because this is a current state rather
 * than the Art. 7(1) record of a disclosure somebody was shown. `.strict()` is
 * what enforces that: a client sending `scopeDigest` gets a 400 rather than being
 * quietly ignored.
 *
 * IDEMPOTENT IN BOTH DIRECTIONS, in the service rather than here. Objecting twice
 * leaves one row, keeps the FIRST timestamp (that is when the member objected)
 * and answers 200 with `changed: false`. A double-submitted form is not an error.
 *
 * WHY ONLY ONE DIRECTION IS GATED. `purposes.put.ts` gates the GRANT and lets a
 * withdrawal through whatever the operator has switched off, because a member who
 * cannot turn something off has been trapped by a config change. The same rule
 * applies here and it points the other way: the direction that STOPS processing
 * is objecting, so objecting survives the flag, and only lifting an objection
 * (which resumes counting) requires the feature to exist. A member can always
 * reduce what is done with their data; they can only restart it where the thing
 * being restarted is real.
 *
 * Nothing here writes to `user_purpose_consents`. See `objections.ts` in
 * `@commonpub/server` for the three reasons an objection is not a consent row.
 */
import { z } from 'zod';
import { setStatisticsObjection } from '@commonpub/server';
import {
  type StatisticsObjectionPayload,
  buildStatisticsObjectionPayload,
  statisticsFloors,
} from './objection.get';

const statisticsObjectionInputSchema = z
  .object({
    /** True to object (stop being counted), false to lift the objection. */
    objected: z.boolean(),
  })
  .strict();

export interface StatisticsObjectionWriteResult extends StatisticsObjectionPayload {
  /**
   * False when the record already said this. A no-op, not an error: a member
   * clicking twice must not be told something failed.
   */
  changed: boolean;
}

export default defineEventHandler(async (event): Promise<StatisticsObjectionWriteResult> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  // Parsed before the gate, because the DIRECTION is what decides the gate.
  const body = await parseBody(event, statisticsObjectionInputSchema);
  if (!body.objected) requireFeature('persona');

  const result = await setStatisticsObjection(db, user.id, body.objected);
  return {
    ...buildStatisticsObjectionPayload(result, statisticsFloors(config)),
    changed: result.changed,
  };
});
