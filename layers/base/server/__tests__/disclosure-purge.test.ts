/**
 * Behavioural tests for the disclosure retention purge worker.
 *
 * Four things are being protected.
 *
 * THE RETENTION IS REAL. `disclosure_events` is the record of who looked at
 * whom. A retention period nobody enforces is a retention period nobody has, so
 * the delete is exercised against a real (PGlite) database with rows either side
 * of the boundary, not asserted from the source text.
 *
 * THE NUMBER DOES NOT DRIFT. The layer deliberately does not import
 * `@commonpub/persona` (persona plan 14.3), so the worker restates the bounds of
 * `dataSharingConfigSchema.disclosureRetentionYears`. A restated constant with no
 * guard is a constant that drifts, so the guard below parses against the REAL Zod
 * object rather than comparing two literals in this file.
 *
 * THE FLAG IS RE-READ. `metrics-rollup.ts` checks its flag once, 15 seconds after
 * boot, and then runs for the life of the process. A delete pass that did the
 * same would keep deleting for a day after an operator switched the feature off.
 *
 * ISOLATION (member-visibility plan D1). This worker belongs to the directory
 * side, which identifies individuals on purpose with consent. It must name no
 * part of the aggregate pipeline, whose whole job is to make individuals
 * unidentifiable. A source sweep asserts that, with a guard that it read the file.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { disclosureEvents } from '@commonpub/schema';
import { dataSharingConfigSchema } from '../../../../packages/persona/src/index';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../packages/server/src/types';
import { harness, installNitroStubs, resetHarness } from '../../test-helpers/nitroStubs';
import {
  DISCLOSURE_RETENTION_DEFAULT_YEARS,
  DISCLOSURE_RETENTION_MAX_YEARS,
  DISCLOSURE_RETENTION_MIN_YEARS,
  disclosureCutoff,
  purgeExpiredDisclosures,
  resolveDisclosureRetentionYears,
} from '../plugins/disclosure-purge';

/**
 * `defineNitroPlugin` is a Nitro auto-import, and the module below is imported
 * STATICALLY so its pure helpers can be unit tested. `vi.hoisted` runs before
 * the import graph is evaluated, which is the only place this global can be
 * defined in time. `installNitroStubs()` re-declares it identically later; it is
 * idempotent, so the two do not fight.
 */
vi.hoisted(() => {
  (globalThis as unknown as Record<string, unknown>).defineNitroPlugin = <T>(handler: T): T =>
    handler;
});

// The worker lives under `server/plugins/`, which Nitro bundles, so this test
// lives in `server/__tests__/` (see `no-vitest-in-nitro-scan.test.ts`).
const SOURCE_PATH = resolve(__dirname, '..', 'plugins', 'disclosure-purge.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Strip comments and string literals, so the isolation sweep reads CODE.
 *
 * The worker's header deliberately names the aggregate rollup table to explain
 * why it touches none of it, and a naive `indexOf` would flag that explanation
 * as the violation it warns about. A naive `/\*[\s\S]*?\*\//` strip is not
 * enough either: a line comment containing `/*` would open a block the scanner
 * never closes and swallow the rest of the file, which is a green sweep over
 * nothing. Same scanner, and same reasoning, as `persona-rollup.test.ts`.
 */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (two === '/*') {
      i += 2;
      while (i < src.length && src.slice(i, i + 2) !== '*/') i += 1;
      i += 2;
      continue;
    }
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      out += ' ';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const code = stripCommentsAndStrings(source);

interface FakeNitro {
  hooks: { hook: (name: string, fn: () => void) => void };
}
type Plugin = (nitro: FakeNitro) => void;

/**
 * A stub standing in for the drizzle DB, so the SCHEDULING tests are decided by
 * timers alone and never by how long a real query took under fake timers.
 *
 * It records the tables it was handed, which is how "touches `disclosure_events`
 * and nothing else" is asserted, and the `where` conditions, which is how the
 * cutoff the worker actually computed is recovered below.
 */
interface StubDb {
  selectTables: unknown[];
  deleteTables: unknown[];
  conditions: unknown[];
  /** Rows the next SELECT returns; each call shifts one batch off the front. */
  batches: Array<Array<{ id: string }>>;
  select: (fields: unknown) => unknown;
  delete: (table: unknown) => unknown;
}

function makeStubDb(batches: Array<Array<{ id: string }>> = []): StubDb {
  const db: StubDb = {
    selectTables: [],
    deleteTables: [],
    conditions: [],
    batches: [...batches],
    select: () => ({
      from: (table: unknown) => {
        db.selectTables.push(table);
        return {
          where: (condition: unknown) => {
            db.conditions.push(condition);
            return { limit: async (): Promise<Array<{ id: string }>> => db.batches.shift() ?? [] };
          },
        };
      },
    }),
    delete: (table: unknown) => {
      db.deleteTables.push(table);
      return { where: async (): Promise<void> => undefined };
    },
  };
  return db;
}

/**
 * Recover the Date bound into a drizzle comparison.
 *
 * `lt(col, date)` stores the value in a `Param` chunk. Walking for it is the
 * only way to assert the cutoff the worker computed from the operator's config,
 * as opposed to re-deriving it in the test and proving nothing.
 */
function boundDate(condition: unknown): Date | null {
  const chunks = (condition as { queryChunks?: unknown[] } | null)?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown } | null)?.value;
    if (value instanceof Date) return value;
  }
  return null;
}

describe('retention bounds parity with dataSharingConfigSchema', () => {
  // The worker cannot import the schema, so this test does, and pins the three
  // numbers by PARSING rather than by comparing literals.
  it('uses the schema default', () => {
    const parsed = dataSharingConfigSchema.parse({});
    expect(parsed.disclosureRetentionYears).toBe(DISCLOSURE_RETENTION_DEFAULT_YEARS);
  });

  it('uses the schema minimum and maximum', () => {
    const ok = (years: number): boolean =>
      dataSharingConfigSchema.safeParse({ disclosureRetentionYears: years }).success;
    expect(ok(DISCLOSURE_RETENTION_MIN_YEARS)).toBe(true);
    expect(ok(DISCLOSURE_RETENTION_MAX_YEARS)).toBe(true);
    expect(ok(DISCLOSURE_RETENTION_MIN_YEARS - 1)).toBe(false);
    expect(ok(DISCLOSURE_RETENTION_MAX_YEARS + 1)).toBe(false);
  });
});

describe('resolveDisclosureRetentionYears', () => {
  it('reads a configured value inside the bounds', () => {
    expect(resolveDisclosureRetentionYears({ disclosureRetentionYears: 5 })).toBe(5);
  });

  it.each<[string, unknown]>([
    ['no dataSharing block', undefined],
    ['a null block', null],
    ['a scalar block', 7],
    ['a missing key', {}],
    ['a string', { disclosureRetentionYears: '3' }],
    ['a fraction', { disclosureRetentionYears: 2.5 }],
    ['NaN', { disclosureRetentionYears: Number.NaN }],
    ['zero', { disclosureRetentionYears: 0 }],
    ['a negative', { disclosureRetentionYears: -4 }],
    ['over the ceiling', { disclosureRetentionYears: 99 }],
  ])('falls back to the default for %s', (_label, value) => {
    // The DEFAULT, never the minimum: a typo must not be able to silently
    // shorten a retention period, because an accountability record deleted
    // early cannot be recovered.
    expect(resolveDisclosureRetentionYears(value)).toBe(DISCLOSURE_RETENTION_DEFAULT_YEARS);
  });
});

describe('disclosureCutoff', () => {
  it('subtracts calendar years, not 365-day years', () => {
    // 2024 is a leap year, so a 365-day subtraction would land on 2023-03-02.
    const cutoff = disclosureCutoff(1, new Date('2024-03-01T12:00:00.000Z'));
    expect(cutoff.toISOString()).toBe('2023-03-01T12:00:00.000Z');
  });

  it('keeps the time of day, so the boundary does not drift by hours', () => {
    const cutoff = disclosureCutoff(2, new Date('2026-08-12T09:30:15.000Z'));
    expect(cutoff.toISOString()).toBe('2024-08-12T09:30:15.000Z');
  });

  it('rolls a 29 February anniversary forward, never backward', () => {
    // JavaScript's own rollover, and it errs toward keeping the record one day
    // longer rather than deleting it one day early.
    const cutoff = disclosureCutoff(1, new Date('2024-02-29T00:00:00.000Z'));
    expect(cutoff.toISOString()).toBe('2023-03-01T00:00:00.000Z');
  });

  it('does not mutate the instant it was given', () => {
    const now = new Date('2026-08-12T00:00:00.000Z');
    disclosureCutoff(3, now);
    expect(now.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });
});

describe('purgeExpiredDisclosures against a real database', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: 'disclosed-member' })).id;
  }, 120_000);

  afterAll(async () => {
    await closeTestDB(db);
  });

  afterEach(async () => {
    await db.delete(disclosureEvents);
  });

  async function seed(disclosedAt: Date, count = 1): Promise<void> {
    await db.insert(disclosureEvents).values(
      Array.from({ length: count }, () => ({
        recipientId: 'acme',
        userId,
        purpose: 'recruiter_visibility',
        scopeDigest: 'abc123',
        disclosedAt,
      })),
    );
  }

  it('deletes rows older than the cutoff and keeps the rest', async () => {
    const now = new Date('2026-08-12T00:00:00.000Z');
    const cutoff = disclosureCutoff(2, now);
    await seed(new Date(cutoff.getTime() - DAY_MS), 3); // expired
    await seed(new Date(cutoff.getTime() + DAY_MS), 2); // still inside the window

    const result = await purgeExpiredDisclosures(db, cutoff);
    expect(result.deleted).toBe(3);
    expect(result.capped).toBe(false);

    const remaining = await db.select().from(disclosureEvents);
    expect(remaining).toHaveLength(2);
    for (const row of remaining) {
      expect(row.disclosedAt.getTime()).toBeGreaterThan(cutoff.getTime());
    }
  });

  it('keeps a row sitting exactly on the boundary', async () => {
    // `<` not `<=`: the row is kept for the retention period, so the instant
    // itself is still inside it.
    const cutoff = new Date('2024-08-12T00:00:00.000Z');
    await seed(cutoff, 1);
    expect((await purgeExpiredDisclosures(db, cutoff)).deleted).toBe(0);
    expect(await db.select().from(disclosureEvents)).toHaveLength(1);
  });

  it('deletes nothing, and reports nothing, on an empty table', async () => {
    expect(await purgeExpiredDisclosures(db, new Date())).toEqual({ deleted: 0, capped: false });
  });

  it('crosses the batch boundary rather than stopping at it', async () => {
    // The delete is batched; a worker that ran one batch and stopped would take
    // a year to drain a backlog.
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    await seed(new Date('2020-01-01T00:00:00.000Z'), 620);
    const result = await purgeExpiredDisclosures(db, cutoff);
    expect(result.deleted).toBe(620);
    expect(result.capped).toBe(false);
    expect(await db.select().from(disclosureEvents)).toHaveLength(0);
  });

  it('is idempotent: a second pass over the same window deletes nothing', async () => {
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    await seed(new Date('2020-01-01T00:00:00.000Z'), 4);
    expect((await purgeExpiredDisclosures(db, cutoff)).deleted).toBe(4);
    expect((await purgeExpiredDisclosures(db, cutoff)).deleted).toBe(0);
  });

  it('leaves the member row alone: this deletes disclosures, not people', async () => {
    await seed(new Date('2000-01-01T00:00:00.000Z'), 2);
    await purgeExpiredDisclosures(db, new Date('2026-01-01T00:00:00.000Z'));
    const [user] = await db.query.users.findMany({ limit: 1 });
    expect(user?.id).toBe(userId);
  });
});

describe('the worker', () => {
  let plugin: Plugin;
  let closeHandlers: Array<() => void> = [];

  function makeNitro(): FakeNitro {
    return {
      hooks: {
        hook: (_name: string, fn: () => void) => {
          closeHandlers.push(fn);
        },
      },
    };
  }

  /** Run the startup timer and let the async body settle. */
  async function boot(): Promise<void> {
    plugin(makeNitro());
    await vi.advanceTimersByTimeAsync(45_000);
  }

  beforeAll(async () => {
    await installNitroStubs();
    // Through `unknown`: the real default is typed against Nitro's `NitroApp`,
    // and this harness supplies only the `hooks.hook` the worker actually uses.
    const mod = await import('../plugins/disclosure-purge');
    plugin = mod.default as unknown as Plugin;
  }, 60_000);

  beforeEach(() => {
    resetHarness();
    // `memberDirectory` is not in the harness defaults, which is correct: the
    // flag ships off. Each test that wants the worker turns it on.
    harness.features.memberDirectory = true;
    harness.db = makeStubDb();
    closeHandlers = [];
    // The plugin refuses to start under NODE_ENV=test, which is the state vitest
    // runs in, so the scheduling tests have to leave that state deliberately.
    vi.stubEnv('NODE_ENV', 'production');
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const fn of closeHandlers) fn();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does nothing at all under NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    await boot();
    expect((harness.db as StubDb).selectTables).toHaveLength(0);
  });

  it('runs once after the startup delay, then daily', async () => {
    await boot();
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(DAY_MS);
    expect((harness.db as StubDb).selectTables).toHaveLength(2);
  });

  it('staggers behind the persona rollup worker', async () => {
    // Two persona passes must not start together, and this one must not land on
    // top of the shared metrics worker either.
    const personaSource = readFileSync(resolve(__dirname, '..', 'plugins', 'persona-rollup.ts'), 'utf8');
    const personaDelay = /STARTUP_DELAY_MS = (\d[\d_]*)/.exec(personaSource);
    const ownDelay = /STARTUP_DELAY_MS = (\d[\d_]*)/.exec(source);
    expect(personaDelay, 'guard: could not read the persona worker delay').not.toBeNull();
    expect(ownDelay, 'guard: could not read this worker delay').not.toBeNull();
    const parse = (raw: string): number => Number(raw.replace(/_/g, ''));
    expect(parse(ownDelay?.[1] ?? '0')).toBeGreaterThan(parse(personaDelay?.[1] ?? '0'));
  });

  it('touches disclosure_events and no other table', async () => {
    harness.db = makeStubDb([[{ id: 'row-1' }]]);
    await boot();
    const db = harness.db as StubDb;
    expect(db.selectTables.length).toBeGreaterThan(0);
    expect(db.selectTables.every((t) => t === disclosureEvents)).toBe(true);
    expect(db.deleteTables).toEqual([disclosureEvents]);
  });

  it('computes the cutoff from the operator configured retention', async () => {
    harness.config = { dataSharing: { disclosureRetentionYears: 5 } };
    const now = new Date('2026-08-12T00:00:00.000Z');
    vi.setSystemTime(now);
    await boot();

    const bound = boundDate((harness.db as StubDb).conditions[0]);
    expect(bound, 'no Date was bound into the purge condition').not.toBeNull();
    // Five calendar years back from the moment the pass ran, which is the boot
    // instant plus the startup delay. Asserted as a window rather than an exact
    // string so the delay can be retuned without rewriting this expectation.
    const fiveYearsBack = disclosureCutoff(5, now).getTime();
    expect(bound?.getTime()).toBeGreaterThanOrEqual(fiveYearsBack);
    expect(bound?.getTime()).toBeLessThanOrEqual(fiveYearsBack + 60_000);
    expect(bound?.getUTCFullYear()).toBe(2021);
  });

  it('falls back to the default retention when the config says nothing', async () => {
    const now = new Date('2026-08-12T00:00:00.000Z');
    vi.setSystemTime(now);
    await boot();
    const bound = boundDate((harness.db as StubDb).conditions[0]);
    expect(bound?.getUTCFullYear()).toBe(2026 - DISCLOSURE_RETENTION_DEFAULT_YEARS);
  });

  it('never starts when features.memberDirectory is off', async () => {
    harness.features.memberDirectory = false;
    await boot();
    expect((harness.db as StubDb).selectTables).toHaveLength(0);
  });

  it('stops purging when the flag is turned off AFTER boot', async () => {
    await boot();
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
    harness.features.memberDirectory = false;
    await vi.advanceTimersByTimeAsync(DAY_MS);
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
  });

  it('survives a failing run without killing the interval', async () => {
    const broken = makeStubDb();
    broken.select = () => {
      throw new Error('database is on fire');
    };
    harness.db = broken;
    await boot();

    harness.db = makeStubDb();
    await vi.advanceTimersByTimeAsync(DAY_MS);
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
  });

  it('stops on close', async () => {
    await boot();
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
    for (const fn of closeHandlers) fn();
    closeHandlers = [];
    await vi.advanceTimersByTimeAsync(DAY_MS * 3);
    expect((harness.db as StubDb).selectTables).toHaveLength(1);
  });
});

describe('isolation sweep (member-visibility plan D1)', () => {
  it('read the worker source, so the assertions below walk something', () => {
    // P7: a broken path, or a stripper that ate the file, would make every
    // assertion here vacuously true.
    expect(source.length).toBeGreaterThan(1000);
    expect(code.length).toBeGreaterThan(500);
    expect(code).toContain('purgeExpiredDisclosures');
  });

  it('the comment stripper is not the thing being tested (positive controls)', () => {
    expect(stripCommentsAndStrings('const a = 1; // metrics_daily\nconst b = 2;')).not.toContain(
      'metrics_daily',
    );
    expect(stripCommentsAndStrings('/* metrics_daily */ const a = 1;')).toContain('const a = 1;');
    // The trap: a line comment containing an unclosed block opener must not
    // swallow the rest of the file.
    expect(stripCommentsAndStrings('// see /* this\nconst kept = 1;')).toContain('const kept = 1;');
    expect(stripCommentsAndStrings("const s = 'metrics_daily'; const kept = 1;")).toContain(
      'const kept = 1;',
    );
  });

  it.each(['persona_metrics_daily', 'personaMetricsDaily', 'runPersonaRollup', 'metrics_daily'])(
    'never names %s in code',
    (forbidden) => {
      // The header names the aggregate table to explain why this worker touches
      // none of it, so the sweep reads code with the prose stripped out.
      expect(code).not.toContain(forbidden);
    },
  );

  it('imports only the disclosure table and drizzle operators', () => {
    const imports = source.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
    expect(imports.length).toBeGreaterThanOrEqual(2);
    for (const line of imports) {
      expect(line).not.toContain('metrics');
      expect(line).not.toContain('@commonpub/persona');
    }
  });
});
