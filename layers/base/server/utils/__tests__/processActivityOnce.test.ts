/**
 * `processActivityOnce` (session 262): an inbound activity is applied at most once
 * and is never lost to a transient failure.
 *
 * Before, all three inboxes claimed the activity id and then answered 400 on any
 * processing error. A 4xx tells the sender not to retry, and a retry would have
 * been dropped as a replay anyway, so one database blip lost the activity for
 * good. Runs against PGlite with the real `recordActivitySeen` /
 * `releaseActivityClaim`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { processedActivities } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import {
  createTestDB,
  closeTestDB,
} from '../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../packages/server/src/types';

interface HttpError extends Error {
  statusCode: number;
  statusMessage: string;
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    return e;
  };
});

const { processActivityOnce } = await import('../inbox');

let db: DB;
beforeAll(async () => {
  db = await createTestDB();
}, 120_000);
afterAll(async () => {
  await closeTestDB(db);
});

const claimed = async (id: string): Promise<boolean> =>
  (await db.select().from(processedActivities).where(eq(processedActivities.activityId, id))).length > 0;

const statusOf = async (p: Promise<unknown>): Promise<number | 'ok'> => {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return (err as HttpError).statusCode;
  }
};

describe('processActivityOnce', () => {
  it('runs a new activity once and ignores its replay', async () => {
    const run = vi.fn(async () => {});
    const id = 'https://remote.example/activities/1';
    expect(await processActivityOnce(db, id, 't', run)).toEqual({ status: 'accepted' });
    expect(await processActivityOnce(db, id, 't', run)).toEqual({ status: 'accepted' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(await claimed(id)).toBe(true);
  });

  it('a transient failure answers 500 and gives the claim back, so the retry is processed', async () => {
    const id = 'https://remote.example/activities/2';
    const failing = vi.fn(async () => {
      throw new Error('connection terminated unexpectedly');
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await statusOf(processActivityOnce(db, id, 't', failing))).toBe(500);
    errors.mockRestore();
    expect(await claimed(id)).toBe(false);

    const retry = vi.fn(async () => {});
    expect(await processActivityOnce(db, id, 't', retry)).toEqual({ status: 'accepted' });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(await claimed(id)).toBe(true);
  });

  it('a server error raised as an H3 5xx is also retryable', async () => {
    const id = 'https://remote.example/activities/3';
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const status = await statusOf(processActivityOnce(db, id, 't', async () => {
      throw (globalThis as unknown as { createError: (o: object) => Error }).createError({ statusCode: 503, statusMessage: 'busy' });
    }));
    errors.mockRestore();
    expect(status).toBe(500);
    expect(await claimed(id)).toBe(false);
  });

  it('a definite rejection keeps its status and its claim (a retry would get the same answer)', async () => {
    const id = 'https://remote.example/activities/4';
    const status = await statusOf(processActivityOnce(db, id, 't', async () => {
      throw (globalThis as unknown as { createError: (o: object) => Error }).createError({ statusCode: 400, statusMessage: 'Invalid activity' });
    }));
    expect(status).toBe(400);
    expect(await claimed(id)).toBe(true);
  });

  it('an activity without an id is processed every time and never claimed', async () => {
    const run = vi.fn(async () => {});
    await processActivityOnce(db, undefined, 't', run);
    await processActivityOnce(db, '', 't', run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
