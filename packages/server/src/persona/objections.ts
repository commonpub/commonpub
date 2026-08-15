import { eq } from 'drizzle-orm';
import { userStatisticsObjections } from '@commonpub/schema';
import { type StatisticsObjectionState, statisticsStateSummary } from '@commonpub/persona';
import type { DB } from '../types.js';

/**
 * The statistics objection: GDPR Art. 21, and deliberately NOT consent.
 *
 * WHY THIS IS NOT A PURPOSE AND NOT IN `consent.ts`. The instance counts its own
 * members' answers into anonymous group totals whether or not anybody agrees:
 * they are totals over records it already holds, computed by the party that
 * already controls them. Asking permission for processing that happens
 * regardless is a dark pattern with good intentions, and it is worse than not
 * asking, because it teaches people that the toggles mean nothing. So statistics
 * run on legitimate interest (Art. 6(1)(f)) and the member gets the instrument
 * that belongs to that basis: an objection. `@commonpub/persona`'s
 * `statistics.ts` holds the copy; this module holds the record.
 *
 * WHY IT IS NOT A `user_purpose_consents` ROW WITH `state: 'objected'`
 * (plan R3.1 D5). Three properties of that table are wrong here, and each one
 * would break something a reader would then have to un-break:
 *
 * 1. A SCOPE DIGEST invalidates a GRANT when what it authorises changes, so the
 *    member is asked again against the new terms. A REFUSAL must survive exactly
 *    that change. An objection carrying a digest would silently lapse the next
 *    time an operator added a field, which is the one outcome a refusal must
 *    never have. "Degrade stale grants, honour stale refusals."
 * 2. The APPEND-ONLY HISTORY there is the Art. 7(1) record of what a member was
 *    shown when they agreed. An objection is a current state, not a disclosure:
 *    there is nothing to prove was displayed, and interleaving the two makes the
 *    consent history unreadable as evidence of either.
 * 3. `PROCESSING_PURPOSE_SPECS` is a registry of things DISCLOSED TO NAMED
 *    RECIPIENTS. Statistics leave nothing. A purpose id for them would put the
 *    deleted `profile_analytics` back by another name.
 *
 * SO: no digest, no snapshot, no history table, no supersede-then-insert. The
 * whole record is the presence of one row. If a later change wants a history of
 * objections, that is a new table with its own reason, not a widening of this
 * one, and it needs an answer to "what is the second row FOR" first.
 *
 * ROW PRESENT MEANS OBJECTED. There is no state column and no `objected boolean`
 * that could be false. The default (counted) is the absence of a record, so it
 * cannot drift by somebody editing a default value in a later migration, and
 * `PERSONA_STATISTICS.defaultObjected` is a literal `false` for the same reason:
 * an objection nobody made is one nobody can be shown to have made.
 *
 * ERASURE: `user_statistics_objections.user_id` cascades on `users.id`, so
 * deleting an account takes the objection with it and there is no erasure code
 * here at all. Nothing was disclosed to anyone, so nothing survives to defend.
 */

/** Where a member stands, with the status line that describes it. */
export interface StatisticsObjection {
  state: StatisticsObjectionState;
  /** `true` exactly when `state` is `'objected'`. Convenience for a SQL caller. */
  objected: boolean;
  /** When the objection was recorded, or `null` while the member is counted. */
  objectedAt: Date | null;
  /**
   * The member-facing status line for `state`, from the persona package.
   *
   * Returned rather than left to the caller so a surface cannot render a
   * sentence that disagrees with the row: two hand-written mirrors of one state
   * drift, and this one is a promise about what is being processed.
   */
  summary: string;
}

export interface SetStatisticsObjectionResult extends StatisticsObjection {
  /** False when the record already said this, which is a no-op, not an error. */
  changed: boolean;
}

function toObjection(objectedAt: Date | null): StatisticsObjection {
  const state: StatisticsObjectionState = objectedAt === null ? 'counted' : 'objected';
  return {
    state,
    objected: state === 'objected',
    objectedAt,
    summary: statisticsStateSummary(state),
  };
}

/**
 * Read the member's current standing. One row at most, keyed by the primary key.
 *
 * Never throws for a user who does not exist: absence of a row and absence of a
 * user are the same answer here (not objected), and a reader asking "is this
 * person excluded from the totals" wants a boolean, not an existence check.
 */
export async function getStatisticsObjection(
  db: DB,
  userId: string,
): Promise<StatisticsObjection> {
  const [row] = await db
    .select({ objectedAt: userStatisticsObjections.objectedAt })
    .from(userStatisticsObjections)
    .where(eq(userStatisticsObjections.userId, userId))
    .limit(1);

  return toObjection(row?.objectedAt ?? null);
}

/**
 * Record or lift an objection. Idempotent in both directions.
 *
 * OBJECTING TWICE leaves one row and does not throw. The primary key on
 * `user_id` makes a second row impossible, and `onConflictDoNothing` makes the
 * second call a no-op rather than a 23505 the route would have to translate: a
 * member clicking twice, or a double-submitted form, must not see an error for
 * asking for something that is already true. The FIRST objection's timestamp is
 * kept, because that is when the member objected; re-recording `objected_at`
 * would rewrite the date of their own act every time a button was pressed.
 *
 * WITHDRAWING deletes the row, rather than writing a second row saying the
 * objection ended. The state is current, not historical (see this module's
 * header), and a member who lifts an objection is asking to be counted again,
 * not asking the instance to keep a record that they once were not.
 *
 * Withdrawal is never gated on anything, exactly as a consent withdrawal is not:
 * whatever an operator changes in config, a member can always come back.
 */
export async function setStatisticsObjection(
  db: DB,
  userId: string,
  objected: boolean,
): Promise<SetStatisticsObjectionResult> {
  if (objected) {
    const [inserted] = await db
      .insert(userStatisticsObjections)
      .values({ userId })
      .onConflictDoNothing({ target: userStatisticsObjections.userId })
      .returning({ objectedAt: userStatisticsObjections.objectedAt });

    if (inserted) return { ...toObjection(inserted.objectedAt), changed: true };

    // Nothing was inserted, so a row was already there. Re-read rather than
    // assuming: a concurrent withdrawal can land between the conflict and here,
    // and reporting a state the table does not hold would be the one lie this
    // surface cannot afford.
    return { ...(await getStatisticsObjection(db, userId)), changed: false };
  }

  const deleted = await db
    .delete(userStatisticsObjections)
    .where(eq(userStatisticsObjections.userId, userId))
    .returning({ userId: userStatisticsObjections.userId });

  return { ...toObjection(null), changed: deleted.length > 0 };
}
