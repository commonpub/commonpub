/**
 * Behavioural tests for `GET /api/users/:username/persona` — the route that
 * makes a member's persona visible on their public profile (plan 8.5).
 *
 * The style follows `server/api/__tests__/persona-routes.test.ts`: the Nitro
 * auto-imports are installed on `globalThis` BEFORE the handler is imported, and
 * `requireFeature`, `parseParams` and `getOptionalUser` are the ACTUAL
 * implementations from `server/utils/`, so a 404/400 assertion here is a
 * statement about shipped code rather than about a stub. Only `@commonpub/server`
 * is doubled; `@commonpub/persona` is pure and its sink/registry rules are part
 * of what this route promises, so it runs for real.
 *
 * The questions worth asking of this route cannot be answered by a source read:
 * whether a private profile is really hidden from a stranger and really shown to
 * its owner, whether a `sensitive` field really never leaves the process, and
 * whether a value whose option was withdrawn really does not print as a raw
 * machine key.
 *
 * The test lives in `users/__tests__/` rather than in `users/[username]/`
 * deliberately: a bracketed directory is read as a glob character class by
 * `npm pack`, so a `__tests__` folder underneath one escapes the layer's
 * `!**\/__tests__/` exclusion and ships to consumers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { PersonaSection } from '@commonpub/persona';
import type { CommonPubConfig } from '@commonpub/config';

// --- @commonpub/server doubles ---------------------------------------------------

const server = vi.hoisted(() => ({
  effectivePersonaSchema: vi.fn(),
  getPersonaValues: vi.fn(),
}));
vi.mock('@commonpub/server', () => server);

// --- mutable request state -------------------------------------------------------

interface HttpErrorInit {
  statusCode: number;
  statusMessage: string;
}
interface HttpError extends Error, HttpErrorInit {}

interface TargetRow {
  id: string;
  status: string;
  profileVisibility: string;
}

interface StoredValues {
  answers: Record<string, string[]>;
  text: Record<string, string>;
  links: Record<string, string>;
  columns: Record<string, string>;
  retired: Array<{ fieldKey: string; values: string[]; text: string | null; retiredAt: string | null }>;
}

interface DriftRow {
  kind: 'missing_field' | 'type_changed' | 'sink_changed' | 'missing_option';
  fieldKey: string;
  detail: string;
  affectedRows: number;
  acknowledgedAt: Date | null;
}

let personaFlag = true;
let routerParams: Record<string, string> = {};
let viewer: { id: string; username: string; role: string; email: string; emailVerified: boolean } | null = null;
let targetRows: TargetRow[] = [];
let storedValues: StoredValues;
let sections: PersonaSection[];
let drift: DriftRow[] = [];
/** Every `select()` the handler issued, so "did it touch the DB at all" is answerable. */
let selectCalls = 0;

function emptyValues(): StoredValues {
  return { answers: {}, text: {}, links: {}, columns: {}, retired: [] };
}

function config(): CommonPubConfig {
  return { features: { persona: personaFlag } } as unknown as CommonPubConfig;
}

interface FakeEvent {
  context: { auth?: { user: unknown } };
  method: string;
  path: string;
}

function event(): FakeEvent {
  return {
    context: viewer === null ? {} : { auth: { user: viewer } },
    method: 'GET',
    path: '/api/users/ada/persona',
  };
}

/** The narrowest possible Drizzle stand-in: `select().from().where().limit()`. */
function fakeDb(): Record<string, unknown> {
  return {
    select: () => {
      selectCalls += 1;
      return {
        from: () => ({
          where: () => ({
            limit: async (): Promise<TargetRow[]> => targetRows,
          }),
        }),
      };
    },
  };
}

// --- Nitro auto-imports, installed before the handler is loaded ------------------

function createErrorStub(init: HttpErrorInit): HttpError {
  return Object.assign(new Error(init.statusMessage), init) as HttpError;
}

Object.assign(globalThis, {
  defineEventHandler: <T>(handler: T): T => handler,
  createError: createErrorStub,
  useDB: (): Record<string, unknown> => fakeDb(),
  useConfig: (): CommonPubConfig => config(),
  getRouterParam: (_e: FakeEvent, name: string): string | undefined => routerParams[name],
  getRequestHeader: (): string | undefined => undefined,
});

const validate = await import('../../../utils/validate');
const auth = await import('../../../utils/auth');
Object.assign(globalThis, {
  requireFeature: validate.requireFeature,
  parseParams: validate.parseParams,
  getOptionalUser: auth.getOptionalUser,
});

interface PublicPersonaFieldShape {
  key: string;
  label: string;
  display: 'chips' | 'text';
  values: string[];
}
interface PublicPersonaResponseShape {
  sections: Array<{ key: string; label: string; fields: PublicPersonaFieldShape[] }>;
  isOwner: boolean;
}

type Handler = (e: FakeEvent) => Promise<PublicPersonaResponseShape>;
const personaProfile = (await import('../[username]/persona.get')).default as unknown as Handler;

/** A template exercising every branch the route has to make a decision about. */
function template(): PersonaSection[] {
  return [
    {
      key: 'basics',
      label: 'Basics',
      fields: [
        // Column-bound: rendered by the profile hero already.
        // Opted in, so the COLUMN rule below is the only thing that can exclude it.
        { key: 'headline', label: 'Job title', type: 'text', column: 'headline', showOnProfile: true },
        { key: 'industry', label: 'Industry', type: 'select', showOnProfile: true, options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'software', label: 'Software' },
        ] },
        // Art. 9 escape hatch: never leaves the process. Opted in by an operator
        // who did not think it through, so `sensitive` has to win on its own.
        { key: 'health', label: 'Health interests', type: 'text', sensitive: true, showOnProfile: true },
        // The DEFAULT after the inversion: the operator expressed no opinion, so
        // this answer is private. No `showOnProfile` key at all, deliberately.
        { key: 'salary', label: 'Salary band', type: 'text' },
        // Free text the operator opted in.
        { key: 'motto', label: 'Motto', type: 'text', showOnProfile: true },
      ],
    },
    {
      key: 'interests',
      label: 'Interests',
      fields: [
        { key: 'interests', label: 'What are you into?', type: 'multiselect', showOnProfile: true, options: [
          { value: 'robotics', label: 'Robotics' },
          { value: 'pcb', label: 'PCB design' },
        ] },
      ],
    },
    {
      key: 'links',
      label: 'Links',
      // Opted in, so the LINK SINK rule is the only thing that can exclude it.
      fields: [{ key: 'link_github', label: 'GitHub', type: 'link', platform: 'github', showOnProfile: true }],
    },
    // A section whose only field is never filled: must not print an empty
    // heading. Opted in, so emptiness is the only reason it is absent.
    {
      key: 'extra',
      label: 'Extra',
      fields: [{ key: 'extra_note', label: 'Anything else', type: 'textarea', showOnProfile: true }],
    },
  ];
}

function fieldKeys(body: PublicPersonaResponseShape): string[] {
  return body.sections.flatMap((s) => s.fields.map((f) => f.key));
}

beforeEach(() => {
  vi.clearAllMocks();
  personaFlag = true;
  routerParams = { username: 'ada' };
  viewer = null;
  selectCalls = 0;
  targetRows = [{ id: 'user-1', status: 'active', profileVisibility: 'public' }];
  storedValues = emptyValues();
  sections = template();
  drift = [];

  server.effectivePersonaSchema.mockImplementation(async () => ({
    sections,
    source: 'builtin',
    savedAt: null,
    drift,
  }));
  server.getPersonaValues.mockImplementation(async () => storedValues);
});

it('the handler loaded (a broken import path would otherwise skip every assertion)', () => {
  expect(typeof personaProfile).toBe('function');
});

// --- Gates -----------------------------------------------------------------------

describe('feature flag', () => {
  it('is 404 when persona is off, before anything touches the database', async () => {
    personaFlag = false;
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });
    expect(selectCalls).toBe(0);
    expect(server.effectivePersonaSchema).not.toHaveBeenCalled();
  });
});

describe('username domain validation', () => {
  it.each([
    ['a space', 'ad a'],
    ['a percent wildcard', 'ada%'],
    ['a quote', "ada'"],
    ['65 characters', 'a'.repeat(65)],
  ])('rejects %s with a 400 before any SQL bind', async (_name, value) => {
    routerParams = { username: value };
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 400 });
    expect(selectCalls).toBe(0);
  });

  it('accepts the alphabet the column actually holds, including a short legacy name', async () => {
    routerParams = { username: 'a_b-1' };
    await expect(personaProfile(event())).resolves.toBeDefined();
    expect(selectCalls).toBe(1);
  });
});

describe('visibility', () => {
  it('404s an unknown or soft-deleted user', async () => {
    targetRows = [];
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });
    expect(server.getPersonaValues).not.toHaveBeenCalled();
  });

  it.each(['private', 'members'])('hides a %s profile from a signed-out stranger', async (visibility) => {
    targetRows = [{ id: 'user-1', status: 'active', profileVisibility: visibility }];
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });
    expect(server.getPersonaValues).not.toHaveBeenCalled();
  });

  it('hides a private profile even from a signed-in stranger', async () => {
    targetRows = [{ id: 'user-1', status: 'active', profileVisibility: 'private' }];
    viewer = { id: 'user-2', username: 'grace', role: 'user', email: 'g@example.com', emailVerified: true };
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('shows a members-only profile to a signed-in viewer', async () => {
    targetRows = [{ id: 'user-1', status: 'active', profileVisibility: 'members' }];
    viewer = { id: 'user-2', username: 'grace', role: 'user', email: 'g@example.com', emailVerified: true };
    const body = await personaProfile(event());
    expect(body.isOwner).toBe(false);
  });

  it('shows a private profile to its OWNER, and says so', async () => {
    targetRows = [{ id: 'user-1', status: 'active', profileVisibility: 'private' }];
    viewer = { id: 'user-1', username: 'ada', role: 'user', email: 'a@example.com', emailVerified: true };
    storedValues.answers = { industry: ['hardware'] };
    const body = await personaProfile(event());
    expect(body.isOwner).toBe(true);
    expect(fieldKeys(body)).toContain('industry');
  });

  it('hides a suspended account from everyone but its owner', async () => {
    targetRows = [{ id: 'user-1', status: 'suspended', profileVisibility: 'public' }];
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });

    viewer = { id: 'user-1', username: 'ada', role: 'user', email: 'a@example.com', emailVerified: true };
    await expect(personaProfile(event())).resolves.toBeDefined();
  });

  it('fails CLOSED on a visibility value the enum does not name', async () => {
    targetRows = [{ id: 'user-1', status: 'active', profileVisibility: 'everyone' }];
    viewer = { id: 'user-2', username: 'grace', role: 'user', email: 'g@example.com', emailVerified: true };
    await expect(personaProfile(event())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reads the answers of the TARGET, never of the viewer', async () => {
    viewer = { id: 'user-2', username: 'grace', role: 'user', email: 'g@example.com', emailVerified: true };
    await personaProfile(event());
    expect(server.getPersonaValues).toHaveBeenCalledWith(expect.anything(), 'user-1', sections);
  });
});

// --- What is and is not disclosed -------------------------------------------------

describe('field eligibility', () => {
  beforeEach(() => {
    storedValues.answers = { industry: ['hardware'], interests: ['pcb', 'robotics'] };
    storedValues.text = {
      health: 'a special-category answer',
      salary: '100k',
      motto: 'measure twice',
      extra_note: '',
    };
    storedValues.links = { link_github: 'https://github.com/ada' };
    storedValues.columns = { headline: 'Firmware engineer' };
  });

  it('never returns a sensitive field, and never returns its value anywhere in the payload', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('health');
    expect(JSON.stringify(body)).not.toContain('special-category');
  });

  /**
   * THE INVERSION (plan R3.1 D1). `salary` carries no `showOnProfile` key at
   * all, which under the shipped model meant "public" and now means "private".
   * Under the old rule this field and its value were both in the payload, so
   * this assertion fails against the code as it shipped.
   */
  it('never returns a field the operator has not opted in, and absent is not opted in', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('salary');
    expect(JSON.stringify(body)).not.toContain('100k');
  });

  it('returns a field the operator opted in with showOnProfile: true', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).toContain('industry');
  });

  /**
   * The load-bearing consequence of D2: with no built-in setting
   * `showOnProfile`, an operator who turns the flag on and changes nothing
   * publishes nothing. A template of eligible, filled, unopted fields must come
   * back completely empty rather than mostly empty.
   */
  it('publishes nothing at all when the operator has opted no field in', async () => {
    for (const section of sections) {
      for (const field of section.fields) delete field.showOnProfile;
    }
    const body = await personaProfile(event());
    expect(body.sections).toEqual([]);
    // Every value in the fixture, none of which may travel.
    for (const secret of ['Hardware', 'measure twice', 'Robotics', '100k']) {
      expect(JSON.stringify(body), secret).not.toContain(secret);
    }
  });

  it('still refuses a sensitive field the operator opted in by mistake', async () => {
    // `sensitive` is checked independently of `showOnProfile`, so the Art. 9
    // escape hatch cannot be undone by ticking a visibility box.
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('health');
  });

  it('never repeats a column-bound field the profile already renders', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('headline');
    expect(JSON.stringify(body)).not.toContain('Firmware engineer');
  });

  it('returns the public free-text and closed-vocabulary fields', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).toEqual(['industry', 'motto', 'interests']);
  });

  /**
   * The hero's `.cpub-profile-social` icon row in `pages/u/[username]/index.vue`
   * has rendered `users.social_links` since long before persona existed, and a
   * persona `link` field is a binding to that same column, not storage of its
   * own. Returning it here prints the same five URLs twice on one page — for
   * every member who ever used `/settings/profile`, with no action of their own,
   * the moment the flag goes on.
   *
   * Asserting the URL is absent from the WHOLE serialised body, not just from
   * the field list: a link that reappeared under some other key would still be
   * the duplicate this excludes, and would still be an unsanitised
   * `users.social_links` value crossing into a template.
   */
  it('never returns a link field: the profile hero already renders that column', async () => {
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('link_github');
    expect(JSON.stringify(body)).not.toContain('github.com/ada');
  });

  it('omits the whole links section, rather than printing an empty heading', async () => {
    const body = await personaProfile(event());
    expect(body.sections.map((s) => s.key)).not.toContain('links');
  });

  it('omits a section with nothing to show, rather than printing an empty heading', async () => {
    const body = await personaProfile(event());
    expect(body.sections.map((s) => s.key)).not.toContain('extra');
  });

  it('returns an empty section list, not a scaffold, when nothing is filled in', async () => {
    storedValues = emptyValues();
    const body = await personaProfile(event());
    expect(body.sections).toEqual([]);
  });
});

describe('retired and drifted keys', () => {
  it('never returns retired answers, whatever they contain', async () => {
    storedValues.retired = [
      { fieldKey: 'old_question', values: ['leaked'], text: 'also leaked', retiredAt: '2026-01-01T00:00:00.000Z' },
    ];
    const body = await personaProfile(event());
    expect(JSON.stringify(body)).not.toContain('leaked');
    expect(JSON.stringify(body)).not.toContain('old_question');
  });

  it('skips a field whose stored rows and schema disagree about type', async () => {
    storedValues.answers = { industry: ['hardware'] };
    drift = [{
      kind: 'type_changed',
      fieldKey: 'industry',
      detail: 'was select, now multiselect',
      affectedRows: 1,
      acknowledgedAt: null,
    }];
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('industry');
  });

  it('keeps a field with missing_option drift but drops the withdrawn value', async () => {
    // The whole field is not the problem here; one stored value is. Dropping the
    // value is the same rule applied per value, and it is what stops a raw
    // machine key printing on a stranger's screen.
    storedValues.answers = { interests: ['robotics', 'withdrawn_option'] };
    drift = [{
      kind: 'missing_option',
      fieldKey: 'interests',
      detail: 'withdrawn_option',
      affectedRows: 1,
      acknowledgedAt: null,
    }];
    const body = await personaProfile(event());
    const field = body.sections.flatMap((s) => s.fields).find((f) => f.key === 'interests');
    expect(field?.values).toEqual(['Robotics']);
  });
});

describe('the shape the page renders', () => {
  it('resolves option labels, so no machine key ever reaches a visitor', async () => {
    storedValues.answers = { industry: ['hardware'], interests: ['pcb', 'robotics'] };
    const body = await personaProfile(event());
    const all = body.sections.flatMap((s) => s.fields);
    expect(all.find((f) => f.key === 'industry')?.values).toEqual(['Hardware']);
    expect(all.find((f) => f.key === 'interests')?.values).toEqual(['PCB design', 'Robotics']);
    expect(JSON.stringify(body)).not.toContain('pcb');
  });

  it('drops a stored value with no matching option rather than printing it raw', async () => {
    storedValues.answers = { industry: ['a_removed_option'] };
    const body = await personaProfile(event());
    expect(fieldKeys(body)).not.toContain('industry');
  });

  it('tells the client how to render each field, so the page resolves no schema', async () => {
    storedValues.answers = { interests: ['robotics'] };
    storedValues.text = { motto: 'measure twice' };
    const body = await personaProfile(event());
    const byKey = new Map(body.sections.flatMap((s) => s.fields).map((f) => [f.key, f]));
    expect(byKey.get('interests')?.display).toBe('chips');
    expect(byKey.get('motto')?.display).toBe('text');
    // 'link' is not a member of the union and no producer can emit it. A display
    // mode nothing returns is a dead branch that reads as a shipped capability.
    const displays = new Set(body.sections.flatMap((s) => s.fields).map((f) => f.display));
    expect([...displays].every((d) => d === 'chips' || d === 'text')).toBe(true);
  });

  it('keeps sections in schema order', async () => {
    storedValues.answers = { industry: ['hardware'], interests: ['robotics'] };
    storedValues.text = { motto: 'measure twice' };
    const body = await personaProfile(event());
    expect(body.sections.map((s) => s.key)).toEqual(['basics', 'interests']);
  });

  it('shows an answer because it is public, with no consent grant anywhere in play', async () => {
    // Aggregation is what the processing purposes govern. A grant is neither
    // mocked nor available here, and the field still renders.
    storedValues.answers = { industry: ['hardware'] };
    const body = await personaProfile(event());
    expect(fieldKeys(body)).toContain('industry');
  });
});

describe('source contract: consent gates aggregation, never display', () => {
  // A behavioural test cannot prove the ABSENCE of a join that a later edit
  // might add, so this reads the shipped file. The guard on the guard: assert
  // the read found a substantial file first, or a wrong path passes green.
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../[username]/persona.get.ts'),
    'utf8',
  );

  /**
   * CODE ONLY. The doc comment at the top of the route explains at length WHY
   * consent is not a gate here and names `user_purpose_consents`,
   * `profile_analytics` and `getUserByUsername` while doing it; a raw scan would
   * flag the route's own rationale.
   */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  it('read the route it is auditing, and the comment stripper left the code behind', () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(code).toContain('export default defineEventHandler');
    // Positive control on the stripper: this phrase is in the doc comment only.
    expect(source).toContain('CONSENT IS NOT A GATE HERE');
    expect(code).not.toContain('CONSENT IS NOT A GATE HERE');
  });

  it('reads no consent table, purpose or scope digest', () => {
    for (const forbidden of [
      'userPurposeConsents',
      'user_purpose_consents',
      'currentPurposeScope',
      'purposeScopeDigest',
      'scopeDigest',
      // The statistics objection is not a gate here either: it refuses
      // aggregation over the instance's own records, not publication of a field
      // the operator chose to publish.
      'userStatisticsObjections',
      'getStatisticsObjection',
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  /**
   * The deleted concepts, pinned in the SOURCE rather than only in behaviour.
   * `publicOnProfile` is gone from `@commonpub/persona` entirely, so a leftover
   * `field.publicOnProfile === false` line would be a typecheck failure today,
   * but this file is also the route's own prose and a paragraph still describing
   * the old default would outlive the code (R3.5: no orphan copy).
   */
  it('names neither deleted identifier anywhere, code or prose', () => {
    for (const dead of ['publicOnProfile', 'profile_analytics']) {
      expect(source, dead).not.toContain(dead);
    }
    // Positive control: the replacement really is in there, so the assertion
    // above is not passing against a file that says nothing about visibility.
    expect(code).toContain('showOnProfile !== true');
  });

  it('does not widen the shared UserProfile DTO', () => {
    // `getUserByUsername` feeds the public API serializer and the federation
    // actor document; this route exists so persona never reaches either.
    expect(code).not.toContain('getUserByUsername');
    expect(code).not.toContain('toPublicUser');
  });
});
