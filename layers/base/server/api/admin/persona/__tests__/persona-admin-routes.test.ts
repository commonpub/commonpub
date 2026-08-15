/**
 * Behavioural tests for the persona admin routes.
 *
 * Invoked for real through `nitroStubs.ts`. What these prove that a source-string
 * read cannot:
 *
 * - a stale `If-Match` is a 409 carrying BOTH timestamps, not a silent
 *   last-writer-wins overwrite of another operator's save;
 * - a save that would orphan stored answers is refused until the operator has
 *   made a purge-or-retain decision, and `?force=true` does NOT waive that
 *   decision;
 * - the drift route acknowledges BEFORE it touches data, so a request that is
 *   going to 404 has not already deleted anything;
 * - the feature gate answers 404 and the permission gate answers 403, and the
 *   feature gate runs first.
 *
 * `personaSectionsSchema`, `sanitizePersonaSchema` and `parsePersonaConfig` are
 * left REAL. They are the validation this route exists to apply.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  harness,
  installNitroStubs,
  makeEvent,
  resetHarness,
  StubHttpError,
  type StubEvent,
} from '../../../../../test-helpers/nitroStubs';

interface Section {
  key: string;
  label: string;
  order?: number;
  fields: Array<Record<string, unknown>>;
}

const SAVED_AT = new Date('2026-08-12T10:00:00.000Z');

function sections(overrides: Partial<Section> = {}): Section[] {
  return [
    {
      key: 'interests',
      label: 'Interests',
      order: 0,
      fields: [
        {
          key: 'interests',
          label: 'What are you into?',
          type: 'multiselect',
          options: [
            { value: 'robotics', label: 'Robotics' },
            { value: 'pcb', label: 'PCB design' },
          ],
        },
      ],
      ...overrides,
    },
  ];
}

const mock = vi.hoisted(() => ({
  effective: null as unknown,
  rowCounts: {} as Record<string, number>,
  optionCounts: {} as Record<string, Record<string, number>>,
  ackOk: true,
  calls: [] as Array<{ fn: string; args: unknown }>,
}));

vi.mock('@commonpub/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commonpub/server')>();
  // `personaSectionsSchema` and `personaFieldSink` belong to
  // `@commonpub/persona` and reach the route through the server barrel's
  // re-export (`packages/server/src/persona/index.ts`). `actual` therefore
  // carries them and no fallback is needed; `persona-server-exports.test.ts`
  // pins that re-export separately so its removal fails loudly rather than
  // silently falling back to a local copy.
  const record = (fn: string, args: unknown): void => {
    mock.calls.push({ fn, args });
  };
  return {
    ...actual,
    effectivePersonaSchema: async () => mock.effective,
    effectivePersonaLinkPlatforms: async () => [
      {
        key: 'github',
        label: 'GitHub',
        hostSuffixes: ['github.com'],
        placeholder: 'https://github.com/you',
        authenticitySignal: true,
      },
    ],
    getInstanceSetting: async () => null,
    // `personaMetricsContext` passes this as `currentPurposeScope`'s
    // `dataSharing` resolver. The real one reads `instance_settings` through a
    // database these route tests stub, so it short-circuits to the file half.
    // `persona-public-routes.test.ts` asserts the resolver is actually passed.
    effectiveDataSharingDocument: async (_db: unknown, config: { dataSharing?: unknown }) =>
      config.dataSharing,
    getPersonaRetiredFields: async () => [],
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
    getPersonaFieldDistribution: async (_db: unknown, input: unknown) => {
      record('getPersonaFieldDistribution', input);
      return {
        field: 'interests',
        label: 'What are you into?',
        items: [{ value: 'robotics', label: 'Robotics', count: 10 }],
        suppressed: 1,
        quantum: 5,
        available: true,
        asOf: null,
      };
    },
    getPersonaLinkPresence: async (_db: unknown, input: unknown) => {
      record('getPersonaLinkPresence', input);
      return { items: [], suppressed: 0, quantum: 5, available: true, asOf: null };
    },
    getAudienceCounts: async (_db: unknown, input: unknown) => {
      record('getAudienceCounts', input);
      // Two slots, matching `PERSONA_AUDIENCE_PAYLOAD_KEYS`. The third counted
      // `profile_analytics` grants and went with that purpose: being counted is
      // not a consent question, so there is no grant to count.
      return {
        openToRecruiters: { available: false as const, reason: 'purpose_not_offered' as const },
        openToSponsorSharing: { available: false as const, reason: 'purpose_not_offered' as const },
        quantum: 1,
        available: true,
        asOf: null,
      };
    },
    countPersonaFieldRows: async (_db: unknown, fieldKey: string) => mock.rowCounts[fieldKey] ?? 0,
    countPersonaFieldOptionRows: async (_db: unknown, fieldKey: string) => mock.optionCounts[fieldKey] ?? {},
    savePersonaSchemaOverride: async (_db: unknown, args: unknown) => {
      record('savePersonaSchemaOverride', args);
      return { ok: true as const, savedAt: new Date('2026-08-12T11:00:00.000Z') };
    },
    clearPersonaSchemaOverride: async (_db: unknown, args: unknown) => {
      record('clearPersonaSchemaOverride', args);
      return { removed: true };
    },
    acknowledgePersonaDrift: async (_db: unknown, _config: unknown, args: unknown) => {
      record('acknowledgePersonaDrift', args);
      return mock.ackOk
        ? { ok: true as const, acknowledged: [] }
        : { ok: false as const, error: 'No drift is recorded for that field' };
    },
    purgePersonaField: async (_db: unknown, args: unknown) => {
      record('purgePersonaField', args);
      return { deleted: 12 };
    },
    retirePersonaField: async (_db: unknown, args: unknown) => {
      record('retirePersonaField', args);
      return { retained: 12, retiredAt: new Date() };
    },
  };
});

type Handler = (event: StubEvent) => Promise<unknown>;

const ROUTE_FILES = {
  get: '../schema.get.ts',
  put: '../schema.put.ts',
  delete: '../schema.delete.ts',
  drift: '../drift/[fieldKey].post.ts',
  metrics: '../../persona-metrics.get.ts',
} as const;
type RouteName = keyof typeof ROUTE_FILES;

const handlers = new Map<RouteName, Handler>();

async function load(name: RouteName): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached !== undefined) return cached;
  const mod = (await import(/* @vite-ignore */ ROUTE_FILES[name])) as { default: Handler };
  handlers.set(name, mod.default);
  return mod.default;
}

async function callOrError(name: RouteName, event: StubEvent): Promise<unknown> {
  const handler = await load(name);
  return await handler(event).catch((err: unknown) => err);
}

function asError(value: unknown): StubHttpError {
  expect(value).toBeInstanceOf(StubHttpError);
  return value as StubHttpError;
}

/** Index-0 access that narrows, so `noUncheckedIndexedAccess` stays honest. */
function first<T>(items: readonly T[], label: string): T {
  const value = items[0];
  if (value === undefined) throw new Error(`${label}: expected at least one entry`);
  return value;
}

beforeAll(async () => {
  await installNitroStubs();
  for (const name of Object.keys(ROUTE_FILES) as RouteName[]) await load(name);
}, 60_000);

beforeEach(() => {
  resetHarness();
  mock.calls.length = 0;
  mock.rowCounts = {};
  mock.optionCounts = {};
  mock.ackOk = true;
  mock.effective = {
    sections: sections(),
    source: 'database',
    savedAt: SAVED_AT,
    drift: [],
  };
});

describe('route discovery guard (P7)', () => {
  it('loaded every admin persona handler', () => {
    expect(handlers.size).toBe(Object.keys(ROUTE_FILES).length);
    for (const name of Object.keys(ROUTE_FILES) as RouteName[]) {
      expect(typeof handlers.get(name), name).toBe('function');
    }
  });
});

describe('gates', () => {
  const cases: Array<[RouteName, StubEvent]> = [
    ['get', makeEvent({ method: 'GET' })],
    ['put', makeEvent({ method: 'PUT', body: { sections: sections() } })],
    ['delete', makeEvent({ method: 'DELETE' })],
    ['drift', makeEvent({ method: 'POST', params: { fieldKey: 'interests' }, body: { action: 'retain' } })],
  ];

  it.each(cases)('%s: features.persona off gives 404, not 403', async (name, event) => {
    harness.features.persona = false;
    expect(asError(await callOrError(name, event)).statusCode).toBe(404);
  });

  it.each(cases)('%s: without settings.manage gives 403', async (name, event) => {
    harness.permissions = ['audit.read'];
    expect(asError(await callOrError(name, event)).statusCode).toBe(403);
  });

  it.each(cases)('%s: the feature gate runs BEFORE the permission gate', async (name, event) => {
    // Otherwise a signed-in non-admin could probe for the feature by watching
    // 403 versus 404.
    harness.features.persona = false;
    harness.permissions = [];
    expect(asError(await callOrError(name, event)).statusCode).toBe(404);
  });
});

describe('GET /api/admin/persona/schema', () => {
  it('returns all three sources plus provenance, and savedAt as the If-Match token', async () => {
    const body = (await (await load('get'))(makeEvent())) as {
      file: unknown;
      db: unknown;
      effective: unknown[];
      source: string;
      savedAt: string | null;
      drift: unknown[];
      platforms: Array<{ key: string }>;
    };
    expect(body.source).toBe('database');
    expect(body.savedAt).toBe(SAVED_AT.toISOString());
    expect(body.effective).toHaveLength(1);
    expect(body.platforms.map((p) => p.key)).toEqual(['github']);
    // No config file in the harness, so the file source is genuinely absent
    // rather than being silently replaced by the built-ins.
    expect(body.file).toBeNull();
    expect(body.db).toBeNull();
    expect(body.drift).toEqual([]);
  });
});

describe('PUT /api/admin/persona/schema — optimistic concurrency', () => {
  it('a stale If-Match is a 409 carrying both timestamps', async () => {
    const stale = new Date('2026-08-12T09:00:00.000Z').toISOString();
    const err = asError(
      await callOrError(
        'put',
        makeEvent({ method: 'PUT', headers: { 'If-Match': stale }, body: { sections: sections() } }),
      ),
    );
    expect(err.statusCode).toBe(409);
    expect(err.data).toMatchObject({
      code: 'PERSONA_SCHEMA_CONFLICT',
      clientSavedAt: stale,
      serverSavedAt: SAVED_AT.toISOString(),
    });
    // The conflict is refused BEFORE anything is written.
    expect(mock.calls.map((c) => c.fn)).not.toContain('savePersonaSchemaOverride');
  });

  it('a matching If-Match saves', async () => {
    const body = (await (await load('put'))(
      makeEvent({
        method: 'PUT',
        headers: { 'If-Match': SAVED_AT.toISOString() },
        body: { sections: sections() },
      }),
    )) as { savedAt: string };
    expect(body.savedAt).toBe('2026-08-12T11:00:00.000Z');
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });

  it('an omitted If-Match is an unconditional write', async () => {
    await (await load('put'))(makeEvent({ method: 'PUT', body: { sections: sections() } }));
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });

  it('an If-Match sent while no override exists is still a conflict', async () => {
    // The override the client was editing has since been reverted; overwriting
    // it silently would undo that revert.
    mock.effective = { sections: sections(), source: 'config', savedAt: null, drift: [] };
    const err = asError(
      await callOrError(
        'put',
        makeEvent({
          method: 'PUT',
          headers: { 'If-Match': SAVED_AT.toISOString() },
          body: { sections: sections() },
        }),
      ),
    );
    expect(err.statusCode).toBe(409);
    expect(err.data).toMatchObject({ serverSavedAt: null });
  });
});

describe('PUT /api/admin/persona/schema — validation', () => {
  it('reports per-field errors with the section and field KEY, not just an index', async () => {
    const bad = sections();
    first(bad, 'fixture sections').fields.push({ key: 'interests', label: 'Duplicate', type: 'text' });
    const err = asError(
      await callOrError('put', makeEvent({ method: 'PUT', body: { sections: bad } })),
    );
    expect(err.statusCode).toBe(400);
    const data = err.data as { code: string; fieldErrors: Array<Record<string, unknown>> };
    expect(data.code).toBe('PERSONA_SCHEMA_INVALID');
    expect(data.fieldErrors.length).toBeGreaterThan(0);
    const issue = first(data.fieldErrors, 'fieldErrors');
    expect(issue).toMatchObject({ sectionKey: 'interests', fieldKey: 'interests' });
    expect(String(issue.message)).toMatch(/Duplicate field key/);
  });

  it('rejects a link field naming a platform this instance does not declare', async () => {
    const bad: Section[] = [
      {
        key: 'links',
        label: 'Links',
        fields: [{ key: 'mastodon', label: 'Mastodon', type: 'link', platform: 'mastodon' }],
      },
    ];
    const err = asError(
      await callOrError('put', makeEvent({ method: 'PUT', body: { sections: bad } })),
    );
    expect(err.statusCode).toBe(400);
    const data = err.data as { fieldErrors: Array<{ message: string; fieldKey: string }> };
    const issue = first(data.fieldErrors, 'fieldErrors');
    expect(issue.fieldKey).toBe('mastodon');
    expect(issue.message).toMatch(/Unknown link platform/);
  });

  it('accepts a link field whose platform IS declared', async () => {
    const good: Section[] = [
      {
        key: 'links',
        label: 'Links',
        fields: [{ key: 'gh', label: 'GitHub', type: 'link', platform: 'github' }],
      },
    ];
    await (await load('put'))(makeEvent({ method: 'PUT', body: { sections: good } }));
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });
});

describe('PUT /api/admin/persona/schema — destructive changes', () => {
  it('a field with NO stored rows can be dropped freely', async () => {
    mock.rowCounts = {};
    await (await load('put'))(makeEvent({ method: 'PUT', body: { sections: [] } }));
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });

  it('dropping a field WITH stored rows is refused until purge or retain is chosen', async () => {
    mock.rowCounts = { interests: 412 };
    const err = asError(
      await callOrError('put', makeEvent({ method: 'PUT', body: { sections: [] } })),
    );
    expect(err.statusCode).toBe(409);
    const data = err.data as { code: string; blockers: Array<Record<string, unknown>> };
    expect(data.code).toBe('PERSONA_SCHEMA_DESTRUCTIVE');
    const blocker = first(data.blockers, 'blockers');
    expect(blocker).toMatchObject({
      fieldKey: 'interests',
      kind: 'field_removed',
      // K-ANONYMISED, floored to the operator's bucket floor. The exact 412 is
      // never sent: this response is a pure read that writes nothing, so an
      // un-floored figure turns "PUT the same document with one option removed"
      // into a per-option census of every member, including those who revoked.
      affectedRows: 410,
      affectedRowsBanded: false,
      requires: 'removal',
    });
    // 5.5: the confirmation still names a number, the floored one.
    expect(String(blocker.detail)).toContain('410');
    expect(String(blocker.detail)).not.toContain('412');
    expect(mock.calls.map((c) => c.fn)).not.toContain('savePersonaSchemaOverride');
  });

  it('?force=true does NOT waive the purge-or-retain decision', async () => {
    mock.rowCounts = { interests: 412 };
    const err = asError(
      await callOrError(
        'put',
        makeEvent({ method: 'PUT', query: { force: 'true' }, body: { sections: [] } }),
      ),
    );
    expect(err.statusCode).toBe(409);
    expect(mock.calls.map((c) => c.fn)).not.toContain('purgePersonaField');
  });

  it('a purge decision saves first, then deletes', async () => {
    mock.rowCounts = { interests: 412 };
    const body = (await (await load('put'))(
      makeEvent({
        method: 'PUT',
        body: { sections: [], removal: { interests: 'purge' } },
      }),
    )) as { removals: Array<{ fieldKey: string; action: string; rows: number }> };
    const order = mock.calls.map((c) => c.fn);
    expect(order.indexOf('savePersonaSchemaOverride')).toBeGreaterThan(-1);
    expect(order.indexOf('purgePersonaField')).toBeGreaterThan(
      order.indexOf('savePersonaSchemaOverride'),
    );
    // Also floored: 12 rows under a floor of 5 reports 10.
    expect(body.removals).toEqual([{ fieldKey: 'interests', action: 'purge', rows: 10 }]);
  });

  it('a retain decision keeps the rows and retires the REMOVED key', async () => {
    mock.rowCounts = { interests: 412 };
    await (await load('put'))(
      makeEvent({ method: 'PUT', body: { sections: [], removal: { interests: 'retain' } } }),
    );
    const order = mock.calls.map((c) => c.fn);
    expect(order).toContain('retirePersonaField');
    expect(order).not.toContain('purgePersonaField');
  });

  it('changing the type of a field with stored rows needs ?force=true', async () => {
    mock.rowCounts = { interests: 412 };
    const retyped = sections();
    first(retyped, 'fixture sections').fields = [
      { key: 'interests', label: 'What are you into?', type: 'textarea' },
    ];

    const refused = asError(
      await callOrError('put', makeEvent({ method: 'PUT', body: { sections: retyped } })),
    );
    expect(refused.statusCode).toBe(409);
    const kinds = (refused.data as { blockers: Array<{ kind: string }> }).blockers.map(
      (b) => b.kind,
    );
    // The type change also moves the field's storage sink, and both are reported
    // so the operator sees the whole consequence rather than the first one.
    expect(kinds).toContain('type_changed');
    expect(kinds).toContain('sink_changed');

    mock.calls.length = 0;
    await (await load('put'))(
      makeEvent({
        method: 'PUT',
        query: { force: 'true' },
        body: { sections: retyped, removal: { interests: 'purge' } },
      }),
    );
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });

  it('dropping an option people actually chose needs ?force=true, and names ITS count', async () => {
    mock.rowCounts = { interests: 412 };
    // 412 rows on the field, but only 30 of them chose the option being
    // dropped. The blocker must name 30: the operator is deciding about the
    // answers that get orphaned, not about the field's total.
    mock.optionCounts = { interests: { robotics: 382, pcb: 30 } };
    const narrowed = sections();
    first(narrowed, 'fixture sections').fields = [
      {
        key: 'interests',
        label: 'What are you into?',
        type: 'multiselect',
        options: [{ value: 'robotics', label: 'Robotics' }],
      },
    ];
    const err = asError(
      await callOrError('put', makeEvent({ method: 'PUT', body: { sections: narrowed } })),
    );
    expect(err.statusCode).toBe(409);
    const blocker = first(
      (err.data as { blockers: Array<{ kind: string; affectedRows: number; detail: string }> }).blockers,
      'blockers',
    );
    expect(blocker.kind).toBe('option_removed');
    expect(blocker.affectedRows, 'the count is the orphaned answers, not the field total').toBe(30);
    // The dropped option VALUES are deliberately NOT named. Naming them makes
    // each refusal one bit of a distribution the metrics module refuses to
    // publish, and eighteen refusals the whole field, from a request that
    // writes nothing and needs only `settings.manage`.
    expect(blocker.detail).not.toContain('pcb');
    expect(blocker.detail).toContain('1 answered option');
    expect(blocker.detail).toContain('30');

    mock.calls.length = 0;
    const saved = (await (await load('put'))(
      makeEvent({ method: 'PUT', query: { force: 'true' }, body: { sections: narrowed } }),
    )) as { forced: boolean };
    expect(saved.forced).toBe(true);
  });

  it('dropping an option nobody chose is not destructive and needs no force', async () => {
    // The field has 412 stored rows, all of them on the option that survives.
    // Demanding a force here would teach an operator that force is routine,
    // which is the one thing force must not become.
    mock.rowCounts = { interests: 412 };
    mock.optionCounts = { interests: { robotics: 412 } };
    const narrowed = sections();
    first(narrowed, 'fixture sections').fields = [
      {
        key: 'interests',
        label: 'What are you into?',
        type: 'multiselect',
        options: [{ value: 'robotics', label: 'Robotics' }],
      },
    ];
    const saved = (await (await load('put'))(
      makeEvent({ method: 'PUT', body: { sections: narrowed } }),
    )) as { forced: boolean };
    expect(saved.forced).toBe(false);
    expect(mock.calls.map((c) => c.fn)).toContain('savePersonaSchemaOverride');
  });

  it('a routine label edit issues no row count and no blocker', async () => {
    const relabelled = sections();
    first(relabelled, 'fixture sections').fields = [
      {
        key: 'interests',
        label: 'Pick your interests',
        type: 'multiselect',
        options: [
          { value: 'robotics', label: 'Robotics' },
          { value: 'pcb', label: 'PCB design' },
        ],
      },
    ];
    const body = (await (await load('put'))(
      makeEvent({ method: 'PUT', body: { sections: relabelled } }),
    )) as { forced: boolean; removals: unknown[] };
    expect(body.forced).toBe(false);
    expect(body.removals).toEqual([]);
  });
});

describe('DELETE /api/admin/persona/schema', () => {
  it('removes the override and reports what the instance serves afterwards', async () => {
    mock.effective = { sections: sections(), source: 'config', savedAt: null, drift: [] };
    const body = (await (await load('delete'))(makeEvent({ method: 'DELETE' }))) as {
      removed: boolean;
      source: string;
      savedAt: string | null;
    };
    expect(body.removed).toBe(true);
    expect(body.source).toBe('config');
    expect(body.savedAt).toBeNull();
    expect(mock.calls.map((c) => c.fn)).toContain('clearPersonaSchemaOverride');
  });
});

describe('POST /api/admin/persona/drift/:fieldKey', () => {
  it('acknowledges BEFORE it purges', async () => {
    await (await load('drift'))(
      makeEvent({ method: 'POST', params: { fieldKey: 'interests' }, body: { action: 'purge' } }),
    );
    const order = mock.calls.map((c) => c.fn);
    expect(order.indexOf('acknowledgePersonaDrift')).toBe(0);
    expect(order.indexOf('purgePersonaField')).toBe(1);
  });

  it('a key with no recorded drift is a 404 and destroys nothing', async () => {
    mock.ackOk = false;
    const err = asError(
      await callOrError(
        'drift',
        makeEvent({ method: 'POST', params: { fieldKey: 'ghost' }, body: { action: 'purge' } }),
      ),
    );
    expect(err.statusCode).toBe(404);
    expect(mock.calls.map((c) => c.fn)).not.toContain('purgePersonaField');
  });

  it('rejects a field key outside the stored alphabet before any lookup', async () => {
    const err = asError(
      await callOrError(
        'drift',
        makeEvent({ method: 'POST', params: { fieldKey: 'Bad-Key!' }, body: { action: 'purge' } }),
      ),
    );
    expect(err.statusCode).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('rejects an action outside purge|retain', async () => {
    const err = asError(
      await callOrError(
        'drift',
        makeEvent({ method: 'POST', params: { fieldKey: 'interests' }, body: { action: 'wipe' } }),
      ),
    );
    expect(err.statusCode).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('retain keeps the rows and reports the count that was kept', async () => {
    const body = (await (await load('drift'))(
      makeEvent({ method: 'POST', params: { fieldKey: 'interests' }, body: { action: 'retain' } }),
    )) as { action: string; rows: number };
    expect(body.action).toBe('retain');
    expect(body.rows).toBe(12);
    expect(mock.calls.map((c) => c.fn)).toContain('retirePersonaField');
  });
});

describe('GET /api/admin/persona-metrics', () => {
  const metricsEvent = (query: Record<string, string> = {}): StubEvent =>
    makeEvent({ path: '/api/admin/persona-metrics', query });

  it('gates on audit.read, not settings.manage', async () => {
    harness.permissions = ['settings.manage'];
    expect(asError(await callOrError('metrics', metricsEvent())).statusCode).toBe(403);
    harness.permissions = ['audit.read'];
    await (await load('metrics'))(metricsEvent());
  });

  it('features.personaAnalytics off gives 404', async () => {
    harness.features.personaAnalytics = false;
    expect(asError(await callOrError('metrics', metricsEvent())).statusCode).toBe(404);
  });

  /**
   * THE CORRECTION (plan R3.4 phase 4). This route used to pass the operator's
   * configured k-anonymity floors, so an answer chosen by three people was
   * withheld from the operator who holds the rows and can read the same answer
   * one profile at a time. It now passes floors that hide nothing.
   *
   * Asserted on the ARGUMENTS rather than on a rendered number, because the
   * floors are applied inside `@commonpub/server` (in SQL, in `HAVING`), which
   * is doubled here. The integration suite in `packages/server` owns the proof
   * that these thresholds produce exact counts; this owns the proof that the
   * route asks for them.
   */
  it('reads live and applies no floor, so nothing is withheld from the operator', async () => {
    await (await load('metrics'))(metricsEvent({ field: 'interests' }));
    const calls = mock.calls.filter((c) => c.fn !== 'x');
    expect(calls.map((c) => c.fn)).toContain('getPersonaFieldDistribution');

    let checked = 0;
    for (const call of calls) {
      const input = call.args as { source?: string; scopeDigest?: string; thresholds?: unknown };
      if (input.source === undefined) continue;
      checked += 1;
      // Live, because an operator tuning a schema needs to see the effect before
      // tomorrow.
      expect(input.source).toBe('live');
      // `minBucket: 1` keeps every bucket and makes the quantisation the
      // identity; `minPopulation: 1` leaves exactly one refusal, for an instance
      // with nobody counted at all.
      expect(input.thresholds).toEqual({ minBucket: 1, minPopulation: 1 });
      // `PersonaReadInput` no longer carries a scope digest: the distributions
      // and the link presence do not join consent at all any more. The audience
      // counts still do, and their digests travel inside `offeredPurposes`.
      expect(input.scopeDigest).toBeUndefined();
    }
    // The guard on the guard: a loop that inspected nothing would pass green.
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('still hands the audience counts a digest, because those really are consent counts', async () => {
    await (await load('metrics'))(metricsEvent());
    const audience = mock.calls.find((c) => c.fn === 'getAudienceCounts');
    expect(audience).toBeDefined();
    const offered = (audience?.args as { offeredPurposes?: Array<{ scopeDigest?: string }> })
      .offeredPurposes;
    expect(Array.isArray(offered)).toBe(true);
    for (const entry of offered ?? []) {
      expect(typeof entry.scopeDigest).toBe('string');
      expect(entry.scopeDigest).not.toBe('');
    }
  });

  it('reports what the PUBLIC API would apply, separately from what it applied', async () => {
    // The page states the difference in the operator's own configured numbers,
    // so the payload has to carry them, and under a name that cannot be read as
    // "the floors used here".
    const body = (await (await load('metrics'))(metricsEvent())) as {
      publicThresholds: { minBucket: number; minPopulation: number };
      quantum: number;
    };
    expect(body.publicThresholds.minBucket).toBeGreaterThanOrEqual(1);
    expect(body.quantum).toBe(1);
    expect(Object.keys(body)).not.toContain('thresholds');
  });

  it('refuses an unknown field with a 400 and issues no query', async () => {
    const err = asError(await callOrError('metrics', metricsEvent({ field: 'nope' })));
    expect(err.statusCode).toBe(400);
    expect(mock.calls.map((c) => c.fn)).not.toContain('getPersonaFieldDistribution');
  });

  it('omits the distribution entirely when no field is asked for', async () => {
    const body = (await (await load('metrics'))(metricsEvent())) as { distribution: unknown };
    expect(body.distribution).toBeNull();
    expect(mock.calls.map((c) => c.fn)).not.toContain('getPersonaFieldDistribution');
  });

  it('returns a null audience rather than a zero when dataSharingConsents is off', async () => {
    // A hard zero would read as "nobody opted in" when it means "nobody could":
    // the grants it counts cannot be given at all while that flag is off.
    harness.features.dataSharingConsents = false;
    const body = (await (await load('metrics'))(metricsEvent())) as { audience: unknown };
    expect(body.audience).toBeNull();
    expect(mock.calls.map((c) => c.fn)).not.toContain('getAudienceCounts');
  });

  it('never publishes a population figure alongside a distribution', async () => {
    const body = (await (await load('metrics'))(metricsEvent({ field: 'interests' }))) as {
      distribution: Record<string, unknown>;
    };
    for (const forbidden of ['eligibleUsers', 'total', 'population']) {
      expect(Object.keys(body.distribution)).not.toContain(forbidden);
    }
  });
});
