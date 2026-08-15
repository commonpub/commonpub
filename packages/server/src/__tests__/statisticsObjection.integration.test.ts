import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, getTableColumns } from 'drizzle-orm';
import { users, userPurposeConsents, userStatisticsObjections } from '@commonpub/schema';
import { PERSONA_STATISTICS, PROCESSING_PURPOSES } from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getStatisticsObjection,
  setStatisticsObjection,
} from '../persona/objections.js';

/**
 * The statistics objection (GDPR Art. 21, plan R3.1 D4 and D5).
 *
 * Two claims are under test and they are different in kind. One is behavioural:
 * objecting excludes, withdrawing re-includes, and neither is an error when
 * repeated. The other is structural: this is NOT consent, so it must not touch
 * `user_purpose_consents`, must carry no scope digest, and must survive exactly
 * the scope changes that lapse a grant. The structural half is the half that
 * would be quietly "improved" away later, so it is asserted directly rather than
 * left to the comments.
 */

async function objectionRows(db: DB, userId: string) {
  return db
    .select()
    .from(userStatisticsObjections)
    .where(eq(userStatisticsObjections.userId, userId));
}

describe('getStatisticsObjection / setStatisticsObjection', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  async function freshUser(tag: string): Promise<string> {
    return (await createTestUser(db, { username: `obj-${tag}-${Date.now()}` })).id;
  }

  it('counts a member who has never acted, with no row on file', async () => {
    const userId = await freshUser('default');
    const state = await getStatisticsObjection(db, userId);
    expect(state.state).toBe('counted');
    expect(state.objected).toBe(false);
    expect(state.objectedAt).toBeNull();
    // The default is the ABSENCE of a record, so it cannot drift by somebody
    // editing a default value in a later migration.
    expect(await objectionRows(db, userId)).toHaveLength(0);
    expect(state.summary).toBe(PERSONA_STATISTICS.countedSummary);
  });

  it('reports counted for a user id that does not exist, rather than throwing', async () => {
    // A reader asks "is this person excluded from the totals", which is a
    // boolean. Absence of a row and absence of a user are the same answer.
    const state = await getStatisticsObjection(db, '00000000-0000-0000-0000-0000000000ff');
    expect(state.state).toBe('counted');
  });

  it('objecting excludes the member and records exactly one row', async () => {
    const userId = await freshUser('object');
    const result = await setStatisticsObjection(db, userId, true);
    expect(result.changed).toBe(true);
    expect(result.state).toBe('objected');
    expect(result.objected).toBe(true);
    expect(result.objectedAt).toBeInstanceOf(Date);
    expect(result.summary).toBe(PERSONA_STATISTICS.objectedSummary);

    const rows = await objectionRows(db, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userId);

    const read = await getStatisticsObjection(db, userId);
    expect(read.state).toBe('objected');
    expect(read.objectedAt).toEqual(result.objectedAt);
  });

  it('objecting twice does not throw, leaves ONE row, and keeps the first timestamp', async () => {
    const userId = await freshUser('twice');
    const first = await setStatisticsObjection(db, userId, true);
    const second = await setStatisticsObjection(db, userId, true);

    expect(second.changed).toBe(false);
    expect(second.state).toBe('objected');
    expect(await objectionRows(db, userId)).toHaveLength(1);
    // The date of the member's own act is not rewritten by a double-submitted
    // form or a second click.
    expect(second.objectedAt).toEqual(first.objectedAt);
  });

  it('withdrawing re-includes the member and deletes the row', async () => {
    const userId = await freshUser('withdraw');
    await setStatisticsObjection(db, userId, true);

    const result = await setStatisticsObjection(db, userId, false);
    expect(result.changed).toBe(true);
    expect(result.state).toBe('counted');
    expect(result.objected).toBe(false);
    expect(result.objectedAt).toBeNull();
    expect(result.summary).toBe(PERSONA_STATISTICS.countedSummary);

    // Deleted, not superseded: the state is current, not historical. There is no
    // second row saying the objection ended.
    expect(await objectionRows(db, userId)).toHaveLength(0);
    expect((await getStatisticsObjection(db, userId)).state).toBe('counted');
  });

  it('withdrawing when nothing was objected is a no-op, not an error', async () => {
    const userId = await freshUser('nowithdraw');
    const result = await setStatisticsObjection(db, userId, false);
    expect(result.changed).toBe(false);
    expect(result.state).toBe('counted');
    expect(await objectionRows(db, userId)).toHaveLength(0);
  });

  it('a member can object, withdraw and object again', async () => {
    const userId = await freshUser('cycle');
    expect((await setStatisticsObjection(db, userId, true)).changed).toBe(true);
    expect((await setStatisticsObjection(db, userId, false)).changed).toBe(true);
    const again = await setStatisticsObjection(db, userId, true);
    expect(again.changed).toBe(true);
    expect(again.state).toBe('objected');
    expect(await objectionRows(db, userId)).toHaveLength(1);
  });

  it('never reads another member\'s objection', async () => {
    const a = await freshUser('a');
    const b = await freshUser('b');
    await setStatisticsObjection(db, a, true);
    expect((await getStatisticsObjection(db, b)).state).toBe('counted');
    expect(await objectionRows(db, b)).toHaveLength(0);
  });

  it('deleting the account takes the objection with it', async () => {
    const userId = await freshUser('erase');
    await setStatisticsObjection(db, userId, true);
    expect(await objectionRows(db, userId)).toHaveLength(1);

    await db.delete(users).where(eq(users.id, userId));

    // The cascade on users.id is the whole erasure story. There is no erasure
    // code in `objections.ts` at all, and nothing was disclosed to anyone, so
    // nothing survives to defend.
    expect(await objectionRows(db, userId)).toHaveLength(0);
  });
});

describe('an objection is not consent (plan R3.1 D5)', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  it('writes nothing into user_purpose_consents', async () => {
    const userId = (await createTestUser(db, { username: `obj-nc-${Date.now()}` })).id;
    await setStatisticsObjection(db, userId, true);
    await setStatisticsObjection(db, userId, false);

    const consents = await db
      .select()
      .from(userPurposeConsents)
      .where(eq(userPurposeConsents.userId, userId));
    expect(consents).toHaveLength(0);
  });

  /**
   * The property that makes the separate table necessary rather than merely
   * tidy. A scope digest exists to LAPSE a grant when what it authorises
   * changes, so the member is asked again. A refusal must survive exactly that
   * change: "degrade stale grants, honour stale refusals". The objection cannot
   * lapse because there is nowhere on the row for a digest to live.
   */
  it('carries no scope digest, no snapshot and no state column to lapse', () => {
    const columns = Object.keys(getTableColumns(userStatisticsObjections)).sort();
    expect(columns).toEqual(['objectedAt', 'userId']);
  });

  it('is reachable without a purpose id, because statistics are not a purpose', () => {
    // If a statistics purpose is ever readmitted to the registry, this fails and
    // the reader is sent to the module header before it becomes a consent row.
    expect([...PROCESSING_PURPOSES] as string[]).not.toContain('profile_analytics');
    for (const id of PROCESSING_PURPOSES) expect(id).not.toMatch(/analytic|statistic|count/i);
    expect(PERSONA_STATISTICS.legalBasis).toBe('legitimate_interest');
    expect(PERSONA_STATISTICS.defaultObjected).toBe(false);
  });
});
