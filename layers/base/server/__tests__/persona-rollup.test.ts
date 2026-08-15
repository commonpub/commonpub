/**
 * Behavioural tests for the persona rollup worker.
 *
 * Two things are being protected here.
 *
 * ISOLATION (plan 14.4). Persona owns `persona_metrics_daily`. If this worker
 * ever writes into `metrics_daily` or registers a series in `TIMESERIES_METRICS`,
 * the persona data becomes reachable through `GET /metrics/timeseries`, which is
 * guarded by `read:analytics` alone and which a `read:*` key satisfies. That is
 * every gate this feature adds, bypassed. A source sweep asserts the worker
 * names none of them, with a guard that it actually read the file.
 *
 * FLAGS AT RUN TIME, not only at startup. `metrics-rollup.ts` checks its flag
 * once, 15 seconds after boot, and then runs for the life of the process. A
 * persona pass that did the same would keep aggregating member answers for up to
 * six hours after an operator switched the feature off.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { harness, installNitroStubs, resetHarness } from '../../test-helpers/nitroStubs';

const mock = vi.hoisted(() => ({
  runs: [] as Array<Record<string, unknown>>,
  fail: false,
  /**
   * Two countable fields, so "only rolls up fields the read routes would serve"
   * has something to exclude. Declared here rather than imported from
   * `@commonpub/persona`, which `@commonpub/layer` does not depend on.
   */
  sections: [
    {
      key: 'basics',
      label: 'Basics',
      order: 0,
      fields: [
        {
          key: 'industry',
          label: 'Industry',
          type: 'select',
          options: [{ value: 'hardware', label: 'Hardware' }],
        },
      ],
    },
    {
      key: 'interests',
      label: 'Interests',
      order: 1,
      fields: [
        {
          key: 'interests',
          label: 'What are you into?',
          type: 'multiselect',
          options: [{ value: 'robotics', label: 'Robotics' }],
        },
      ],
    },
  ],
}));

vi.mock('@commonpub/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commonpub/server')>();
  return {
    ...actual,
    effectivePersonaSchema: async () => ({
      sections: mock.sections,
      source: 'builtin' as const,
      savedAt: null,
      drift: [],
    }),
    listPersonaAggregatableFields: async () => [
      {
        key: 'interests',
        label: 'What are you into?',
        sectionKey: 'interests',
        sectionLabel: 'Interests',
        type: 'multiselect' as const,
        maxSelections: null,
        options: [{ value: 'robotics', label: 'Robotics' }],
      },
    ],
    effectivePersonaLinkPlatforms: async () => [],
    // `personaMetricsContext` passes this as `currentPurposeScope`'s
    // `dataSharing` resolver. The real one reads `instance_settings` through a
    // database this worker test stubs, so it short-circuits to the file half.
    // `persona-public-routes.test.ts` asserts the resolver is actually passed.
    effectiveDataSharingDocument: async (_db: unknown, config: { dataSharing?: unknown }) =>
      config.dataSharing,
    runPersonaRollup: async (_db: unknown, input: Record<string, unknown>) => {
      if (mock.fail) throw new Error('rollup exploded');
      mock.runs.push(input);
      return { day: input.day, rowsWritten: 3, finalisedDay: null, finalisedRows: 0 };
    },
  };
});

interface FakeNitro {
  hooks: { hook: (name: string, fn: () => void) => void };
}

type Plugin = (nitro: FakeNitro) => void;

// This test lives in `server/__tests__/`, NOT beside the plugin in
// `server/plugins/`. Nitro bundles what it finds under `server/plugins/`, and a
// stray non-test `.ts` there reaches vitest and 500s every route in the app
// (see `no-vitest-in-nitro-scan.test.ts` for the full account).
const SOURCE_PATH = resolve(__dirname, '..', 'plugins', 'persona-rollup.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

/**
 * Strip comments and string literals, so the sweep reads CODE.
 *
 * The worker's header comment deliberately names `runDailyRollup` and
 * `metrics_daily` to explain why it touches neither, and a naive `indexOf` would
 * flag that explanation as the violation it is warning about. A naive
 * `/\*[\s\S]*?\*\//` strip is not enough either: a line comment containing
 * something like `/*` would open a block the scanner never closes and swallow
 * the rest of the file, which is a green sweep over nothing. So this is a real
 * scanner, and it carries positive controls below.
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

/** Index-0 access that narrows, so `noUncheckedIndexedAccess` stays honest. */
function first<T>(items: readonly T[], label: string): T {
  const value = items[0];
  if (value === undefined) throw new Error(`${label}: expected at least one entry`);
  return value;
}

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

/** Run the plugin's startup timer and let its async body settle. */
async function boot(): Promise<void> {
  plugin(makeNitro());
  await vi.advanceTimersByTimeAsync(30_000);
}

beforeAll(async () => {
  await installNitroStubs();
  const mod = (await import('../plugins/persona-rollup')) as { default: Plugin };
  plugin = mod.default;
}, 60_000);

beforeEach(() => {
  resetHarness();
  mock.runs.length = 0;
  mock.fail = false;
  closeHandlers = [];
  // The plugin refuses to start under NODE_ENV=test, which is exactly the state
  // vitest runs in, so the schedule tests have to leave that state deliberately.
  vi.stubEnv('NODE_ENV', 'production');
  vi.useFakeTimers();
});

afterEach(() => {
  for (const fn of closeHandlers) fn();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('isolation sweep (plan 14.4)', () => {
  it('read the worker source and the sweep has something to walk', () => {
    // P7: a broken path, or a stripper that ate the file, would make every
    // assertion below vacuously true.
    expect(source.length).toBeGreaterThan(500);
    expect(code.length).toBeGreaterThan(500);
    expect(code).toContain('runPersonaRollup');
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

  it.each(['runDailyRollup', 'metricsDaily', 'metrics_daily', 'TIMESERIES_METRICS'])(
    'never names %s in code',
    (forbidden) => {
      expect(code).not.toContain(forbidden);
    },
  );

  it('writes through the persona rollup function and nothing else', () => {
    const imported = /import\s*\{([\s\S]*?)\}\s*from/.exec(code);
    expect(imported, 'the worker must import from @commonpub/server').not.toBeNull();
    expect(imported?.[1]).toContain('runPersonaRollup');
    expect(imported?.[1]).not.toContain('backfillMetricsDaily');
  });
});

describe('scheduling', () => {
  it('does nothing at all under NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    await boot();
    expect(mock.runs).toHaveLength(0);
  });

  it('runs once after the startup delay, then on the interval', async () => {
    await boot();
    expect(mock.runs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mock.runs).toHaveLength(2);
  });

  it('staggers behind the shared metrics worker', () => {
    // metrics-rollup starts at 15s; two aggregate passes must not start together.
    const metrics = readFileSync(resolve(__dirname, '..', 'plugins', 'metrics-rollup.ts'), 'utf8');
    const metricsDelay = /\}, (\d[\d_]*)\);/.exec(metrics);
    const personaDelay = /STARTUP_DELAY_MS = (\d[\d_]*)/.exec(source);
    expect(metricsDelay, 'guard: could not read the shared worker delay').not.toBeNull();
    expect(personaDelay, 'guard: could not read the persona worker delay').not.toBeNull();
    const parse = (raw: string): number => Number(raw.replace(/_/g, ''));
    expect(parse(personaDelay?.[1] ?? '0')).toBeGreaterThan(parse(metricsDelay?.[1] ?? '0'));
  });

  it('passes a UTC day key, and no offered purpose on an instance with no recipient', async () => {
    await boot();
    const input = first(mock.runs, 'rollup runs');
    expect(String(input.day)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Both surviving purposes require a declared, papered recipient, so the
    // default instance offers none and the audience slots report themselves
    // unoffered. The pass still runs: distributions and link presence are the
    // instance counting its own answers under legitimate interest, and a guard
    // that skipped the pass when no purpose was offerable would silently stop
    // thin instances producing statistics at all.
    expect(input.offeredPurposes).toEqual([]);
    expect(input.fields).toBeDefined();
  });

  it('carries the live digest beside each purpose once a recipient is named', async () => {
    harness.config = {
      dataSharing: {
        recipients: [
          {
            id: 'contoso',
            name: 'Contoso Tools',
            privacyPolicyUrl: 'https://contoso.example/privacy',
            purposes: ['sponsor_sharing'],
            relationship: 'processor',
          },
        ],
      },
    };
    await boot();
    const offered = first(mock.runs, 'rollup runs').offeredPurposes as Array<{
      purpose: string;
      scopeDigest: string;
    }>;
    expect(offered.map((o) => o.purpose)).toEqual(['sponsor_sharing']);
    expect(first(offered, 'offered purposes').scopeDigest).not.toBe('');
  });

  it('still rolls up with dataSharingConsents off, because it counts no grants', async () => {
    // The gate used to include that flag on the reasoning that the pass counted
    // nothing but purpose grants. It no longer does: distributions and link
    // presence run on legitimate interest and exclude anyone who objected, and
    // the objection switch is gated on `persona` + `personaAnalytics`, which is
    // exactly the pair this worker requires.
    harness.features.dataSharingConsents = false;
    await boot();
    expect(mock.runs).toHaveLength(1);
  });

  it('only rolls up fields the read routes would serve', async () => {
    await boot();
    const fields = first(mock.runs, 'rollup runs').fields as Array<{ fieldKey: string }>;
    // The allow-list stub names one key; the template carries two countable
    // fields, so an unfiltered pass would write more than this.
    expect(fields.map((f) => f.fieldKey)).toEqual(['interests']);
  });

  it('survives a failing run without killing the interval', async () => {
    mock.fail = true;
    await boot();
    expect(mock.runs).toHaveLength(0);
    mock.fail = false;
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mock.runs).toHaveLength(1);
  });
});

describe('feature gates', () => {
  it.each(['publicApi', 'persona', 'personaAnalytics'])(
    'never starts when features.%s is off',
    async (flag) => {
      harness.features[flag] = false;
      await boot();
      expect(mock.runs).toHaveLength(0);
    },
  );

  it('stops aggregating when a flag is turned off AFTER boot', async () => {
    await boot();
    expect(mock.runs).toHaveLength(1);
    harness.features.personaAnalytics = false;
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mock.runs).toHaveLength(1);
  });
});
