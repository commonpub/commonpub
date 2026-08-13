/**
 * Behavioural tests for the four public persona metrics routes.
 *
 * These handlers are invoked for real (see `nitroStubs.ts` for what is faked and
 * what is not). The three properties worth a real invocation:
 *
 * 1. A `read:*` key is REFUSED with 403 on every one of them. That is the whole
 *    point of `WILDCARD_PROTECTED_SCOPES`: keys already in the field were issued
 *    for content metrics and must not silently pick up member cohort data. The
 *    scope decision here is the shipped `hasScope`, not a copy.
 * 2. A disabled flag gives 404, never 403, so a non-participating instance does
 *    not reveal that the surface exists.
 * 3. The distribution response carries no population figure under any name.
 *
 * `currentPurposeScope`, `resolvePersonaThresholds` and `personaMetricsFields`
 * are left REAL because they touch no database and are what decide the digest
 * every aggregate is bound to. Only the query functions are stubbed.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  harness,
  installNitroStubs,
  makeEvent,
  resetHarness,
  StubHttpError,
  type StubEvent,
} from '../../../../../../../test-helpers/nitroStubs';

const mock = vi.hoisted(() => ({
  snapshotDay: '2026-08-11' as string | null,
  calls: [] as Array<{ fn: string; input: Record<string, unknown> }>,
  /** How many times `personaMetricsContext` resolved the effective recipient list. */
  sharingResolverCalls: 0,
  /**
   * A template, not the built-ins, so the fixture does not import
   * `@commonpub/persona` (which `@commonpub/layer` deliberately does not depend
   * on). `bio` is column-bound free text and therefore NOT countable, which is
   * what the "not aggregatable" domain check is asserted against.
   */
  sections: [
    {
      key: 'basics',
      label: 'Basics',
      order: 0,
      fields: [
        { key: 'bio', label: 'About you', type: 'textarea', column: 'bio' },
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
  const record = (fn: string, input: Record<string, unknown>): void => {
    mock.calls.push({ fn, input });
  };
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
        key: 'industry',
        label: 'Industry',
        sectionKey: 'basics',
        sectionLabel: 'Basics',
        type: 'select' as const,
        maxSelections: null,
        options: [{ value: 'hardware', label: 'Hardware' }],
      },
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
    effectivePersonaLinkPlatforms: async () => [
      {
        key: 'github',
        label: 'GitHub',
        hostSuffixes: ['github.com'],
        placeholder: 'https://github.com/you',
        authenticitySignal: true,
      },
    ],
    // `personaMetricsContext` passes this as `currentPurposeScope`'s
    // `dataSharing` resolver, so the digest covers the file recipient list UNION
    // the ones an operator stored through /admin/data-sharing. The real
    // implementation reads `instance_settings`, and these routes run against a
    // stub database, so it is recorded and short-circuited to the file half. The
    // recording is the point: a test below asserts it ran, so dropping the
    // resolver (which would silently make the aggregates count nobody the moment
    // a recipient is stored) fails here rather than in production.
    effectiveDataSharingDocument: async (_db: unknown, config: { dataSharing?: unknown }) => {
      // Counted separately from `mock.calls`, which the "never binds it into
      // SQL" assertions require to be EMPTY. This resolver runs before any
      // query function and recording it there would make those assertions pass
      // for the wrong reason, or fail for no reason.
      mock.sharingResolverCalls += 1;
      return config.dataSharing;
    },
    latestFinalisedSnapshot: async () =>
      mock.snapshotDay === null
        ? null
        : { day: mock.snapshotDay, population: 40, populationSuppressed: false },
    getPersonaFieldDistribution: async (_db: unknown, input: Record<string, unknown>) => {
      record('getPersonaFieldDistribution', input);
      return {
        field: 'interests',
        label: 'What are you into?',
        items: [{ value: 'robotics', label: 'Robotics', count: 10 }],
        suppressed: 1,
        quantum: 5,
        available: true,
        asOf: mock.snapshotDay,
      };
    },
    getPersonaLinkPresence: async (_db: unknown, input: Record<string, unknown>) => {
      record('getPersonaLinkPresence', input);
      return {
        items: [{ platform: 'github', label: 'GitHub', count: 15, authenticitySignal: true }],
        suppressed: 0,
        quantum: 5,
        available: true,
        asOf: mock.snapshotDay,
      };
    },
    getAudienceCounts: async (_db: unknown, input: Record<string, unknown>) => {
      record('getAudienceCounts', input);
      return {
        sharingAnalytics: { available: true as const, count: 40 },
        openToRecruiters: { available: false as const, reason: 'purpose_not_offered' as const },
        openToSponsorSharing: { available: false as const, reason: 'purpose_not_offered' as const },
        quantum: 5,
        available: true,
        asOf: mock.snapshotDay,
      };
    },
  };
});

type Handler = (event: StubEvent) => Promise<unknown>;

const ROUTES = ['fields', 'distribution', 'links', 'audience'] as const;
type RouteName = (typeof ROUTES)[number];

const handlers = new Map<RouteName, Handler>();

async function load(name: RouteName): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached !== undefined) return cached;
  const mod = (await import(`../${name}.get.ts`)) as { default: Handler };
  handlers.set(name, mod.default);
  return mod.default;
}

/** The only query that satisfies every route; `field` is ignored by three of them. */
function eventFor(name: RouteName): StubEvent {
  return makeEvent({ path: `/api/public/v1/metrics/persona/${name}`, query: { field: 'interests' } });
}

async function statusOf(name: RouteName, event: StubEvent): Promise<number> {
  const handler = await load(name);
  try {
    await handler(event);
    return 200;
  } catch (err) {
    if (err instanceof StubHttpError) return err.statusCode;
    throw err;
  }
}

beforeAll(async () => {
  await installNitroStubs(true);
  // Warm every handler once so the first real assertion is not also paying for
  // the `@commonpub/server` module graph.
  for (const name of ROUTES) await load(name);
}, 60_000);

beforeEach(() => {
  resetHarness();
  mock.calls.length = 0;
  mock.snapshotDay = '2026-08-11';
});

describe('route discovery guard (P7)', () => {
  it('loaded all four handlers', () => {
    expect(handlers.size).toBe(ROUTES.length);
    for (const name of ROUTES) expect(typeof handlers.get(name)).toBe('function');
  });
});

describe('read:audience is wildcard protected', () => {
  it.each(ROUTES)('%s: a read:* key gets 403', async (name) => {
    harness.apiScopes = ['read:*'];
    expect(await statusOf(name, eventFor(name))).toBe(403);
  });

  it.each(ROUTES)('%s: a read:audience key succeeds', async (name) => {
    harness.apiScopes = ['read:audience'];
    expect(await statusOf(name, eventFor(name))).toBe(200);
  });

  it.each(ROUTES)('%s: a read:* key that ALSO holds read:audience succeeds', async (name) => {
    // The exact-match branch runs before the protection check, so an explicit
    // grant is unaffected by the new leaf. That order is what stops this
    // hardening from breaking a key an operator deliberately issued.
    harness.apiScopes = ['read:*', 'read:audience'];
    expect(await statusOf(name, eventFor(name))).toBe(200);
  });

  it.each(ROUTES)('%s: a read:analytics key gets 403', async (name) => {
    // Deliberately NOT `read:analytics`: a key issued for content metrics must
    // not silently gain member cohort data.
    harness.apiScopes = ['read:analytics'];
    expect(await statusOf(name, eventFor(name))).toBe(403);
  });

  it.each(ROUTES)('%s: no API key at all is 401', async (name) => {
    harness.apiScopes = undefined;
    expect(await statusOf(name, eventFor(name))).toBe(401);
  });
});

describe('feature gates 404 rather than 403', () => {
  it.each(ROUTES)('%s: features.persona off gives 404', async (name) => {
    harness.features.persona = false;
    expect(await statusOf(name, eventFor(name))).toBe(404);
  });

  it.each(ROUTES)('%s: features.personaAnalytics off gives 404', async (name) => {
    harness.features.personaAnalytics = false;
    expect(await statusOf(name, eventFor(name))).toBe(404);
  });

  it.each(ROUTES)('%s: features.dataSharingConsents off gives 404', async (name) => {
    // The counting cannot outlive its consent surface. Every number these four
    // routes publish is a count of purpose GRANTS, and `dataSharingConsents`
    // governs the page where a member gives and withdraws them: an operator who
    // switched that off to revise recipient copy used to leave three of these
    // four publishing cohorts nobody could then manage, which is the shape
    // Art. 7(3) exists to prevent. The rollup plugin gates on it too.
    harness.features.dataSharingConsents = false;
    expect(await statusOf(name, eventFor(name))).toBe(404);
  });

  it('the flag gate runs BEFORE the scope gate, so a bad key still sees 404', async () => {
    // Otherwise a caller could probe for the feature by watching 403 vs 404.
    harness.features.persona = false;
    harness.apiScopes = ['read:*'];
    expect(await statusOf('fields', eventFor('fields'))).toBe(404);
  });
});

describe('GET /persona/fields', () => {
  it('returns descriptors with multiValued derived from the field type', async () => {
    const handler = await load('fields');
    const body = (await handler(makeEvent({ query: {} }))) as {
      items: Array<{ fieldKey: string; multiValued: boolean; sectionLabel: string }>;
      total: number;
      truncated: boolean;
      quantum: number;
      asOf: string | null;
    };
    expect(body.items.map((i) => i.fieldKey)).toEqual(['industry', 'interests']);
    expect(body.items.find((i) => i.fieldKey === 'interests')?.multiValued).toBe(true);
    expect(body.items.find((i) => i.fieldKey === 'industry')?.multiValued).toBe(false);
    expect(body.total).toBe(2);
    expect(body.truncated).toBe(false);
    expect(body.quantum).toBeGreaterThanOrEqual(5);
    expect(body.asOf).toBe('2026-08-11');
  });

  it('reports truncation instead of silently shortening the list', async () => {
    const handler = await load('fields');
    const body = (await handler(makeEvent({ query: { limit: '1' } }))) as {
      items: unknown[];
      total: number;
      truncated: boolean;
    };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.truncated).toBe(true);
  });

  it('rejects a limit outside 1..100 with a 400 carrying the flattened issues', async () => {
    const handler = await load('fields');
    const err = await handler(makeEvent({ query: { limit: '101' } })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StubHttpError);
    expect((err as StubHttpError).statusCode).toBe(400);
    expect((err as StubHttpError).data).toHaveProperty('fieldErrors');
  });
});

describe('GET /persona/distribution', () => {
  it('serves the finalised snapshot, never a live read', async () => {
    const handler = await load('distribution');
    await handler(makeEvent({ query: { field: 'interests' } }));
    const call = mock.calls.find((c) => c.fn === 'getPersonaFieldDistribution');
    expect(call?.input.source).toBe('rollup');
  });

  it('binds the CURRENT scope digest, so a stale grant joins to nothing', async () => {
    const handler = await load('distribution');
    await handler(makeEvent({ query: { field: 'interests' } }));
    const call = mock.calls.find((c) => c.fn === 'getPersonaFieldDistribution');
    expect(typeof call?.input.scopeDigest).toBe('string');
    expect(call?.input.scopeDigest).not.toBe('');
  });

  it('refuses an unknown field with a 400 and never binds it into SQL', async () => {
    const handler = await load('distribution');
    const err = await handler(makeEvent({ query: { field: 'not_a_field' } })).catch(
      (e: unknown) => e,
    );
    expect((err as StubHttpError).statusCode).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('refuses a field that exists in the template but is not aggregatable', async () => {
    // `bio` is in the template. It is column-bound free text, so it must never
    // be reachable as a cohort, and the domain check is what stops it.
    const hasBio = mock.sections.some((s) => s.fields.some((f) => f.key === 'bio'));
    expect(hasBio, 'fixture guard: bio must exist in the template').toBe(true);
    const handler = await load('distribution');
    const err = await handler(makeEvent({ query: { field: 'bio' } })).catch((e: unknown) => e);
    expect((err as StubHttpError).statusCode).toBe(400);
  });

  it('requires the field parameter', async () => {
    const handler = await load('distribution');
    const err = await handler(makeEvent({ query: {} })).catch((e: unknown) => e);
    expect((err as StubHttpError).statusCode).toBe(400);
  });

  it('publishes no population figure under any name', async () => {
    const handler = await load('distribution');
    const body = (await handler(makeEvent({ query: { field: 'interests' } }))) as Record<
      string,
      unknown
    >;
    for (const forbidden of ['eligibleUsers', 'total', 'population', 'eligible']) {
      expect(Object.keys(body)).not.toContain(forbidden);
    }
    expect(body.quantum).toBe(5);
    expect(body.asOf).toBe('2026-08-11');
  });
});

describe('GET /persona/links and /persona/audience', () => {
  it('links serves the rollup and passes the effective platform set', async () => {
    const handler = await load('links');
    await handler(makeEvent());
    const call = mock.calls.find((c) => c.fn === 'getPersonaLinkPresence');
    expect(call?.input.source).toBe('rollup');
    expect(call?.input.platforms).toHaveLength(1);
  });

  it('audience passes ONLY the offerable purposes, each carrying the live digest', async () => {
    const handler = await load('audience');
    await handler(makeEvent());
    const call = mock.calls.find((c) => c.fn === 'getAudienceCounts');
    const offered = call?.input.offeredPurposes as Array<{ purpose: string; scopeDigest: string }>;
    // `toEqual`, not `toContain`: the title says "only", and `toContain` passes
    // just as happily when the route wrongly passes a deferred purpose through.
    expect(offered.map((o) => o.purpose)).toEqual(['profile_analytics']);
    expect(offered.every((o) => o.scopeDigest === call?.input.scopeDigest)).toBe(true);
    // B9 itself (a purpose nobody can grant must not publish a hard zero) is
    // proven against the real function in
    // `packages/server/src/__tests__/personaMetrics.integration.test.ts`.
    // Asserting it on the response here only reads back this file's own mock.
  });

  it('resolves the scope digest over the effective recipient list, not the config file', async () => {
    // `personaMetricsContext` must pass BOTH resolvers to `currentPurposeScope`.
    // Omitting `dataSharing` computes the digest over file recipients alone,
    // which disagrees with the digest `/api/consent/purposes` records a grant
    // against the moment an operator stores a recipient in the database. Every
    // consent join then matches nothing and every aggregate silently returns
    // zero, fail-closed and invisible.
    mock.sharingResolverCalls = 0;
    const handler = await load('audience');
    await handler(makeEvent());
    expect(mock.sharingResolverCalls).toBeGreaterThan(0);
  });

  it('reports no_snapshot_yet rather than inventing a day', async () => {
    mock.snapshotDay = null;
    const handler = await load('fields');
    const body = (await handler(makeEvent({ query: {} }))) as { asOf: string | null };
    expect(body.asOf).toBeNull();
  });
});
