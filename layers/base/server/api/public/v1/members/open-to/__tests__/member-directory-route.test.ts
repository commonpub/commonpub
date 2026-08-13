/**
 * Behavioural tests for `GET /api/public/v1/members/open-to/{audience}` — the
 * one public endpoint that returns identified people rather than aggregates.
 *
 * The handler is invoked for real through the layer's Nitro harness, and the
 * three guards are the SHIPPED ones: `requireFeature` and `requireApiScope`
 * come from `server/utils/`, and `hasScope` (with the wildcard-protected set)
 * comes from `@commonpub/server` unstubbed. A test that reimplemented the gate
 * it is checking would prove nothing, and every property below is one a source
 * read cannot answer:
 *
 * - a `read:*` key must be REFUSED where a `read:members` key is accepted;
 * - a `read:members` key with no recipient binding must be refused too, because
 *   a disclosure nobody can attribute is the failure this whole feature exists
 *   to avoid;
 * - a disabled flag must be 404 and not 403, and must be decided BEFORE the
 *   scope check, or a caller can probe for the surface with a junk key;
 * - no email may appear in the payload under any name, asserted on the
 *   SERIALISED body rather than on the type.
 *
 * WHAT IS DOUBLED AND WHAT IS NOT. Only the functions that touch the database
 * (`effectivePersonaSchema`, `effectivePersonaLinkPlatforms`,
 * `effectiveDataSharingDocument`, `resolveKeyRecipient`, `listOpenMembers`) are
 * stubbed. `currentPurposeScope`, `purposeScopeDigest`, `recipientCoversPurpose`
 * and `hasScope` are real, because those are the ones that decide what this
 * route is allowed to do. The stub for `listOpenMembers` projects its fixture
 * row through the REAL `toPublicUser`, so the "no email" assertion is a
 * statement about the shipped serializer and not about a hand-written literal.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WILDCARD_PROTECTED_SCOPES } from '@commonpub/schema';
import {
  harness,
  installNitroStubs,
  makeEvent,
  resetHarness,
  StubHttpError,
  type StubEvent,
} from '../../../../../../../test-helpers/nitroStubs';

// --- Fixtures ---------------------------------------------------------------------

interface FixtureRecipient {
  id: string;
  name: string;
  privacyPolicyUrl: string;
  purposes: string[];
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
  agreementRef?: string;
}

const ACME: FixtureRecipient = {
  id: 'acme-robotics',
  name: 'Acme Robotics',
  privacyPolicyUrl: 'https://acme.example/privacy',
  purposes: ['recruiter_visibility'],
  relationship: 'independent_controller',
  agreementRef: 'DPA-2026-04',
};

const SPONSOR: FixtureRecipient = {
  id: 'globex-sponsor',
  name: 'Globex',
  privacyPolicyUrl: 'https://globex.example/privacy',
  purposes: ['sponsor_sharing'],
  relationship: 'independent_controller',
  agreementRef: 'DPA-2026-05',
};

const mock = vi.hoisted(() => ({
  /** The effective recipient list, file UNION database, as the route sees it. */
  recipients: [] as Array<Record<string, unknown>>,
  /** Every call into the directory module, so "what did the route pass" is answerable. */
  calls: [] as Array<{ fn: string; input: Record<string, unknown> }>,
  /** Set to make `listOpenMembers` reject, for the error-mapping tests. */
  listThrows: null as Error | null,
  drift: [] as Array<{ kind: string; fieldKey: string; detail: string; affectedRows: number; acknowledgedAt: Date | null }>,
  /**
   * A template rather than the built-ins, so the fixture states exactly which
   * fields exist. Filter validation itself is tested against the real schema in
   * `packages/server/src/__tests__/memberDirectory.integration.test.ts`.
   */
  sections: [
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
    },
  ],
}));

/**
 * The row the projection starts from. It CARRIES AN EMAIL on purpose: the stub
 * hands it to the real `toPublicUser`, so if that serializer ever grew an email
 * field the "no @ in the payload" assertion below would catch it here, at the
 * route, rather than only in the package's own tests.
 */
const MEMBER_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'ada',
  displayName: 'Ada Lovelace',
  headline: 'Builds small robots',
  bio: 'Mostly ARM and a lot of solder.',
  avatarUrl: null,
  bannerUrl: null,
  pronouns: 'she/her',
  location: 'Manchester',
  website: 'https://ada.example',
  skills: ['soldering'],
  socialLinks: { github: 'https://github.com/ada' },
  profileVisibility: 'public',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  deletedAt: null,
  // Not part of `PublicUserRow`. Present so the serializer has something to
  // leak if it ever regresses.
  email: 'ada@example.com',
};

vi.mock('@commonpub/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commonpub/server')>();
  return {
    ...actual,
    effectivePersonaSchema: async () => ({
      sections: mock.sections,
      source: 'builtin' as const,
      savedAt: null,
      drift: mock.drift,
    }),
    effectivePersonaLinkPlatforms: async () => [
      {
        key: 'github',
        label: 'GitHub',
        hostSuffixes: ['github.com'],
        placeholder: 'https://github.com/you',
        authenticitySignal: true,
      },
    ],
    effectiveDataSharingDocument: async () => ({
      recipients: mock.recipients,
      policyVersion: '2026-08',
    }),
    resolveKeyRecipient: async (
      _db: unknown,
      _config: unknown,
      key: { recipientId?: string | null },
    ) => {
      const id = key?.recipientId?.trim();
      if (!id) return null;
      return mock.recipients.find((r) => r.id === id) ?? null;
    },
    listOpenMembers: async (_db: unknown, input: Record<string, unknown>) => {
      mock.calls.push({ fn: 'listOpenMembers', input });
      if (mock.listThrows !== null) throw mock.listThrows;
      const items = [
        {
          ...actual.toPublicUser(MEMBER_ROW as never),
          persona: [
            {
              fieldKey: 'interests',
              label: 'What are you into?',
              display: 'chips' as const,
              values: ['Robotics'],
            },
          ],
        },
      ];
      return {
        items,
        total: 1,
        hasMore: false,
        limit: input.limit as number,
        offset: input.offset as number,
        disclosed: items.length,
      };
    },
  };
});

// --- Loading the handler ------------------------------------------------------------

type Handler = (event: StubEvent) => Promise<unknown>;

let handler: Handler;

/** An API key row, narrowed to what the route reads off `event.context`. */
function keyEvent(
  init: {
    recipientId?: string | null;
    audience?: string;
    query?: Record<string, string | string[]>;
  } = {},
): StubEvent {
  return makeEvent({
    path: `/api/public/v1/members/open-to/${init.audience ?? 'recruiters'}`,
    params: { audience: init.audience ?? 'recruiters' },
    query: (init.query ?? {}) as Record<string, string>,
    context: {
      apiKey: {
        id: '22222222-2222-4222-8222-222222222222',
        recipientId: init.recipientId === undefined ? ACME.id : init.recipientId,
      },
    },
  });
}

async function statusOf(event: StubEvent): Promise<number> {
  try {
    await handler(event);
    return 200;
  } catch (err) {
    if (err instanceof StubHttpError) return err.statusCode;
    throw err;
  }
}

async function errorOf(event: StubEvent): Promise<StubHttpError> {
  try {
    await handler(event);
    throw new Error('expected the handler to reject, but it resolved');
  } catch (err) {
    if (err instanceof StubHttpError) return err;
    throw err;
  }
}

beforeAll(async () => {
  await installNitroStubs(true);
  // `as unknown as` and no `.ts` in the specifier: the real export is an
  // `EventHandler<H3Event>`, and the harness event is a structural stand-in
  // rather than a full `H3Event`, so the two do not overlap for TypeScript.
  const mod = (await import('../[audience].get')) as unknown as { default: Handler };
  handler = mod.default;
}, 60_000);

beforeEach(() => {
  resetHarness();
  harness.features.memberDirectory = true;
  harness.apiScopes = ['read:members'];
  mock.calls.length = 0;
  mock.listThrows = null;
  mock.drift = [];
  mock.recipients = [{ ...ACME }, { ...SPONSOR }];
});

describe('route discovery guard (P7)', () => {
  it('loaded the handler', () => {
    expect(typeof handler).toBe('function');
  });
});

describe('read:members is wildcard protected', () => {
  it('a read:* key gets 403', async () => {
    // The whole point of `WILDCARD_PROTECTED_SCOPES`. Keys already in the field
    // were issued to read content and instance metrics; none of those grants
    // was a grant to enumerate members.
    harness.apiScopes = ['read:*'];
    expect(await statusOf(keyEvent())).toBe(403);
    expect(mock.calls).toHaveLength(0);
  });

  it('a read:* key that ALSO holds read:members succeeds', async () => {
    harness.apiScopes = ['read:*', 'read:members'];
    expect(await statusOf(keyEvent())).toBe(200);
  });

  it('a read:audience key gets 403', async () => {
    // The neighbouring aggregate scope is NOT this one. `read:audience` buys
    // quantised counts; this endpoint returns the people themselves.
    harness.apiScopes = ['read:audience'];
    expect(await statusOf(keyEvent())).toBe(403);
  });

  it('a read:users key gets 403', async () => {
    harness.apiScopes = ['read:users'];
    expect(await statusOf(keyEvent())).toBe(403);
  });

  it('no API key at all is 401', async () => {
    harness.apiScopes = undefined;
    expect(await statusOf(keyEvent())).toBe(401);
  });

  it('the scope is in the shipped wildcard-protected set', () => {
    // Asserted against the constant the gate reads, not against a copy: this is
    // the fact that makes the three tests above true, and it lives in
    // `@commonpub/schema` so the docs, the admin screen and `hasScope` cannot
    // disagree about it.
    expect(WILDCARD_PROTECTED_SCOPES).toContain('read:members');
  });
});

describe('the recipient binding is what makes a disclosure attributable', () => {
  it('a read:members key with NO recipient binding gets 403', async () => {
    expect(await statusOf(keyEvent({ recipientId: null }))).toBe(403);
    expect(mock.calls).toHaveLength(0);
  });

  it('a blank recipient binding gets 403', async () => {
    expect(await statusOf(keyEvent({ recipientId: '   ' }))).toBe(403);
  });

  it('a binding naming a recipient this instance no longer declares gets 403', async () => {
    // An operator who deletes a recipient has withdrawn the disclosure. The key
    // must stop reading immediately rather than wait for someone to revoke it.
    mock.recipients = [{ ...SPONSOR }];
    expect(await statusOf(keyEvent({ recipientId: ACME.id }))).toBe(403);
    expect(mock.calls).toHaveLength(0);
  });

  it('a key bound to a recipient not declared for this audience gets 403', async () => {
    // Globex is a sponsor. Asking the recruiter directory is refused even
    // though the key holds the scope and the binding resolves.
    const err = await errorOf(keyEvent({ recipientId: SPONSOR.id, audience: 'recruiters' }));
    expect(err.statusCode).toBe(403);
    expect(err.statusMessage).toContain('recruiter_visibility');
    expect(mock.calls).toHaveLength(0);
  });

  it('the same key IS accepted for the audience it is declared for', async () => {
    expect(await statusOf(keyEvent({ recipientId: SPONSOR.id, audience: 'sponsors' }))).toBe(200);
    expect(mock.calls[0]?.input.audience).toBe('sponsors');
  });

  it('refuses the binding BEFORE validating the query', async () => {
    // Authorisation before validation: a caller who may not read this audience
    // learns nothing about the filter surface, not even which parameters exist.
    const err = await errorOf(
      keyEvent({ recipientId: null, query: { limit: '9999', interests: 'nope' } }),
    );
    expect(err.statusCode).toBe(403);
  });
});

describe('feature gates 404 rather than 403', () => {
  it.each(['persona', 'dataSharingConsents', 'memberDirectory'])(
    'features.%s off gives 404',
    async (flag) => {
      harness.features[flag] = false;
      expect(await statusOf(keyEvent())).toBe(404);
    },
  );

  it('the flag gate runs BEFORE the scope gate, so a bad key still sees 404', async () => {
    // Otherwise a caller could probe for the directory by watching 403 vs 404.
    harness.features.memberDirectory = false;
    harness.apiScopes = ['read:*'];
    expect(await statusOf(keyEvent())).toBe(404);
  });

  it('memberDirectory defaults OFF in the harness, matching the shipped default', () => {
    resetHarness();
    expect(harness.features.memberDirectory).toBeUndefined();
  });
});

describe('the audience path segment', () => {
  it.each(['recruiters', 'sponsors'])('%s is a real audience', async (audience) => {
    expect(await statusOf(keyEvent({ recipientId: audience === 'sponsors' ? SPONSOR.id : ACME.id, audience }))).toBe(200);
  });

  it('an unknown audience is 404, not 500 and not 400', async () => {
    expect(await statusOf(keyEvent({ audience: 'investors' }))).toBe(404);
    expect(mock.calls).toHaveLength(0);
  });

  it('an empty audience is 404', async () => {
    const event = makeEvent({
      path: '/api/public/v1/members/open-to/',
      params: {},
      context: { apiKey: { id: 'k', recipientId: ACME.id } },
    });
    expect(await statusOf(event)).toBe(404);
  });

  it('maps recruiters to recruiter_visibility and sponsors to sponsor_sharing', async () => {
    // The refusal message names the purpose, which is how the mapping is
    // observable from outside the module.
    const recruiters = await errorOf(keyEvent({ recipientId: SPONSOR.id, audience: 'recruiters' }));
    expect(recruiters.statusMessage).toContain('recruiter_visibility');
    const sponsors = await errorOf(keyEvent({ recipientId: ACME.id, audience: 'sponsors' }));
    expect(sponsors.statusMessage).toContain('sponsor_sharing');
  });
});

describe('the happy path', () => {
  it('returns members and reports one disclosure per member returned', async () => {
    const body = (await handler(keyEvent())) as {
      items: Array<{ username: string; persona: unknown[] }>;
      total: number | null;
      hasMore: boolean;
      limit: number;
      offset: number;
      disclosed: number;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.username).toBe('ada');
    expect(body.items[0]?.persona).toHaveLength(1);
    expect(body.disclosed).toBe(body.items.length);
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('passes the recipient AND the key id, so every row is attributable to both', async () => {
    await handler(keyEvent());
    const input = mock.calls[0]?.input;
    expect(input?.recipientId).toBe(ACME.id);
    expect(input?.apiKeyId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('binds a non-empty live scope digest, so a stale grant joins to nothing', async () => {
    await handler(keyEvent());
    const digest = mock.calls[0]?.input.scopeDigest;
    expect(typeof digest).toBe('string');
    expect(digest).not.toBe('');
  });

  it('the digest MOVES when a recipient is added, degrading every earlier grant', async () => {
    // This is the reason the route passes `effectiveDataSharingDocument` rather
    // than letting `currentPurposeScope` read the config file alone: a
    // DB-declared recipient that moved no digest would be reading members whose
    // grant was given before that recipient was ever named to them.
    await handler(keyEvent());
    const before = mock.calls[0]?.input.scopeDigest;
    mock.recipients = [
      { ...ACME },
      { ...SPONSOR },
      {
        id: 'initech',
        name: 'Initech',
        privacyPolicyUrl: 'https://initech.example/privacy',
        purposes: ['recruiter_visibility'],
        relationship: 'independent_controller',
        agreementRef: 'DPA-2026-06',
      },
    ];
    mock.calls.length = 0;
    await handler(keyEvent());
    expect(mock.calls[0]?.input.scopeDigest).not.toBe(before);
  });

  it('passes the resolved sections and link platforms, not the config file', async () => {
    await handler(keyEvent());
    const input = mock.calls[0]?.input;
    expect(input?.sections).toBe(mock.sections);
    expect((input?.linkPlatforms as unknown[]).length).toBe(1);
  });

  it('withholds a drifted field key but keeps a missing_option field', async () => {
    // Same rule the member's own public profile applies: a value printed under
    // a question that changed meaning misdescribes the person, while a
    // withdrawn OPTION is dropped per value inside the projection.
    mock.drift = [
      { kind: 'type_changed', fieldKey: 'interests', detail: '', affectedRows: 3, acknowledgedAt: null },
      { kind: 'missing_option', fieldKey: 'industry', detail: '', affectedRows: 1, acknowledgedAt: null },
    ];
    await handler(keyEvent());
    expect(mock.calls[0]?.input.driftedFieldKeys).toEqual(['interests']);
  });
});

describe('no email reaches the wire', () => {
  it('the serialised body contains no "@" anywhere', async () => {
    const body = await handler(keyEvent());
    const serialised = JSON.stringify(body);
    // On the SERIALISED payload, not on the type: a type says what the compiler
    // was told, and this endpoint is the one where being wrong about it matters.
    expect(serialised).not.toContain('@');
  });

  it('no key called email, at any depth', async () => {
    const body = await handler(keyEvent());
    const seen: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          seen.push(key);
          walk(child);
        }
      }
    };
    walk(body);
    // Guard the guard: a walk that visited nothing would pass this vacuously.
    expect(seen.length).toBeGreaterThan(10);
    for (const key of seen) {
      expect(key.toLowerCase()).not.toContain('email');
    }
  });

  it('the fixture row DID carry an email, so the assertion above is not vacuous', () => {
    expect(MEMBER_ROW.email).toContain('@');
  });
});

describe('query validation', () => {
  it('accepts limit 50 and refuses 51, because these are people', async () => {
    expect(await statusOf(keyEvent({ query: { limit: '50' } }))).toBe(200);
    expect(mock.calls[0]?.input.limit).toBe(50);
    mock.calls.length = 0;
    expect(await statusOf(keyEvent({ query: { limit: '51' } }))).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('the cap is half the metrics family, and comes from the directory module', async () => {
    const { DIRECTORY_LIMIT_MAX, DIRECTORY_LIMIT_DEFAULT } = await import('@commonpub/server');
    expect(DIRECTORY_LIMIT_MAX).toBe(50);
    expect(DIRECTORY_LIMIT_DEFAULT).toBe(20);
  });

  it('a 400 carries the flattened issues', async () => {
    const err = await errorOf(keyEvent({ query: { limit: '0' } }));
    expect(err.statusCode).toBe(400);
    expect(err.data).toHaveProperty('fieldErrors');
  });

  it('refuses a negative offset', async () => {
    expect(await statusOf(keyEvent({ query: { offset: '-1' } }))).toBe(400);
  });

  it('accepts repeated filter parameters', async () => {
    await handler(keyEvent({ query: { interests: ['robotics', 'pcb'] } }));
    expect(mock.calls[0]?.input.filters).toMatchObject({ interests: ['robotics', 'pcb'] });
  });

  it('accepts comma-joined filter parameters, which no legal option value can contain', async () => {
    await handler(keyEvent({ query: { hasLink: 'github,linkedin' } }));
    expect(mock.calls[0]?.input.filters).toMatchObject({ hasLink: ['github', 'linkedin'] });
  });

  it('drops empty entries rather than binding an empty string', async () => {
    await handler(keyEvent({ query: { industry: 'hardware,,  ,' } }));
    expect(mock.calls[0]?.input.filters).toMatchObject({ industry: ['hardware'] });
  });

  it('refuses a filter list longer than the option cap', async () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => `v${i}`).join(',');
    expect(await statusOf(keyEvent({ query: { interests: tooMany } }))).toBe(400);
  });

  it('passes q and location through unchanged', async () => {
    await handler(keyEvent({ query: { q: 'ada', location: 'Manchester' } }));
    expect(mock.calls[0]?.input.filters).toMatchObject({ q: 'ada', location: 'Manchester' });
  });

  it('refuses an over-long q', async () => {
    expect(await statusOf(keyEvent({ query: { q: 'x'.repeat(81) } }))).toBe(400);
  });
});

describe('directory errors keep their own status', () => {
  it('an unknown filter field surfaces as a 400 carrying its code', async () => {
    const { MemberDirectoryError } = await import('@commonpub/server');
    mock.listThrows = new MemberDirectoryError('This instance has no "industry" field to filter on', {
      code: 'UNKNOWN_FILTER_FIELD',
      status: 400,
      field: 'industry',
    });
    const err = await errorOf(keyEvent({ query: { industry: 'hardware' } }));
    expect(err.statusCode).toBe(400);
    expect(err.data).toMatchObject({ code: 'UNKNOWN_FILTER_FIELD', field: 'industry' });
  });

  it('a purpose that does not cover disclosing identity surfaces as a 404', async () => {
    // `sponsor_sharing` is exactly this case today: its copy names interests,
    // tech stack and profile links, and never says a name or a town is handed
    // over. The module refuses; the route must not turn that into a 500.
    const { MemberDirectoryError } = await import('@commonpub/server');
    mock.listThrows = new MemberDirectoryError('does not cover disclosing who somebody is', {
      code: 'PURPOSE_DOES_NOT_COVER_IDENTITY',
      status: 404,
    });
    const err = await errorOf(keyEvent({ recipientId: SPONSOR.id, audience: 'sponsors' }));
    expect(err.statusCode).toBe(404);
    expect(err.data).toMatchObject({ code: 'PURPOSE_DOES_NOT_COVER_IDENTITY' });
  });

  it('an unrelated error is NOT swallowed into a tidy status', async () => {
    mock.listThrows = new Error('connection terminated');
    await expect(handler(keyEvent())).rejects.toThrow('connection terminated');
  });
});

/**
 * The published contract and the published documentation are hand-written
 * literals, so nothing about them is observable from a response. These sweeps
 * are what stop the endpoint shipping undocumented, and each one asserts it
 * actually read its file (P7): a broken path reads zero bytes, and zero bytes
 * is how a sweeping test passes green while checking nothing.
 */
describe('the contract and the docs describe this endpoint', () => {
  const LAYER = resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
  const REPO = resolve(LAYER, '..', '..');
  const openapi = readFileSync(
    resolve(LAYER, 'server/api/public/v1/openapi.json.get.ts'),
    'utf8',
  );
  const docs = readFileSync(resolve(REPO, 'docs/public-api.md'), 'utf8');

  it('read both files (P7)', () => {
    expect(openapi.length).toBeGreaterThan(5000);
    expect(docs.length).toBeGreaterThan(5000);
  });

  it('the OpenAPI document carries the path, the scope and the audience enum', () => {
    expect(openapi).toContain("'/members/open-to/{audience}'");
    expect(openapi).toContain("bearer: ['read:members']");
    expect(openapi).toContain("enum: ['recruiters', 'sponsors']");
  });

  it('every wildcard-protected scope is named in the docs as not covered by read:*', () => {
    // Derived from the constant rather than from a hand-kept list, so a scope
    // added to the protected set with no documentation fails HERE rather than
    // in an integrator's inbox. The section heading is matched too, so a
    // passing mention elsewhere in the file does not satisfy it.
    const heading = '### Scopes `read:*` does not cover';
    expect(docs).toContain(heading);
    const section = docs.slice(docs.indexOf(heading));
    expect(WILDCARD_PROTECTED_SCOPES.length).toBeGreaterThanOrEqual(2);
    for (const scope of WILDCARD_PROTECTED_SCOPES) {
      expect(section, `${scope} is wildcard protected but undocumented`).toContain(`\`${scope}\``);
    }
  });

  it('the scope table has a read:members row pointing at this endpoint', () => {
    expect(docs).toContain('| `read:members` |');
    expect(docs).toContain('/members/open-to/:audience');
  });

  it('the docs say the two things a member is owed: no email, and every read logged', () => {
    const section = docs.slice(docs.indexOf('## Member visibility directory'));
    expect(section.length).toBeGreaterThan(500);
    expect(section.toLowerCase()).toContain('email');
    expect(section.toLowerCase()).toContain('logged');
    expect(section.toLowerCase()).toContain('direct message');
  });
});
