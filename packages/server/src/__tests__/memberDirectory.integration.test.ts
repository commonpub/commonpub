import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import {
  disclosureEvents,
  userPersonaAnswers,
  userPersonaText,
  userPurposeConsents,
  userSharedLinks,
  userStatisticsObjections,
  users,
} from '@commonpub/schema';
import type { PurposeScopeSnapshot } from '@commonpub/schema';
import { BUILTIN_PERSONA_LINK_PLATFORMS, purposeScopeDigest } from '@commonpub/persona';
import type { PersonaSection, ProcessingPurposeId } from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  DIRECTORY_LIMIT_MAX,
  MemberDirectoryError,
  directoryProjectableFields,
  listDisclosuresForMember,
  listOpenMembers,
  recordDisclosures,
  type ListOpenMembersInput,
  type OpenMembersPage,
} from '../persona/directory.js';

/**
 * Directory plan section 8, in full.
 *
 * Most of this file is ABSENCE. The interesting property of a consent-gated
 * member listing is who it refuses to return and what it refuses to publish
 * about the people it does, so a suite that only proved the happy path would
 * prove almost nothing. Every exclusion cohort below is seeded with real answers
 * and a real profile, so a leak shows up as a visible row rather than as a
 * silently empty page.
 */

// --- The template under test ------------------------------------------------------

const INDUSTRY_OPTIONS = [
  { value: 'software', label: 'Software' },
  { value: 'aerospace', label: 'Aerospace' },
];

const INTEREST_OPTIONS = [
  { value: 'rust', label: 'Rust' },
  { value: 'pcb_design', label: 'PCB design' },
];

const TECH_OPTIONS = [
  { value: 'vue', label: 'Vue' },
  { value: 'postgres', label: 'PostgreSQL' },
];

const SECTIONS: PersonaSection[] = [
  {
    key: 'basics',
    label: 'Basics',
    fields: [
      // Column-bound: already on the `toPublicUser` payload, never repeated.
      { key: 'display_name', label: 'Display name', type: 'text', column: 'displayName' },
      { key: 'industry', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS },
      // Free text, public: projected, because it is already on the public profile.
      { key: 'about_me', label: 'About you', type: 'textarea', maxLength: 500 },
      // Art. 9 escape hatch. Never published, whatever its sink, by any consent.
      { key: 'health', label: 'Health', type: 'select', options: INDUSTRY_OPTIONS, sensitive: true },
      // NOT on the public profile: `showOnProfile` is absent, which after the
      // inversion is the default and means `/api/users/:username/persona` never
      // returns it. It IS disclosed here, and that is the decision rather than a
      // leak: `recruiter_visibility`'s copy names the member's answers directly
      // instead of pointing at their profile, so the grant is what authorises
      // this and the profile flag has nothing to say about it.
      { key: 'off_profile_note', label: 'Working style', type: 'textarea' },
      // Its storage IS users.social_links, which toPublicUser already carries.
      { key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      { key: 'interests', label: 'Interests', type: 'multiselect', options: INTEREST_OPTIONS },
    ],
  },
  {
    key: 'tech_stack',
    label: 'Tech stack',
    fields: [
      { key: 'tech_stack', label: 'Tech stack', type: 'multiselect', options: TECH_OPTIONS },
    ],
  },
];

const AGGREGATABLE_KEYS = ['industry', 'interests', 'tech_stack'];

const RECRUITER_DIGEST = purposeScopeDigest({
  policyVersion: '1',
  dataClasses: ['persona_selections', 'public_identity', 'profile_links', 'location_coarse'],
  recipientIds: ['acme'],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
});

/** A grant carrying this authorises nothing: the operator added a recipient since. */
const STALE_DIGEST = purposeScopeDigest({
  policyVersion: '1',
  dataClasses: ['persona_selections', 'public_identity', 'profile_links', 'location_coarse'],
  recipientIds: [],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
});

const SNAPSHOT: PurposeScopeSnapshot = {
  purposeLabel: 'Let people hiring see my profile in the members directory',
  offSummary: 'off',
  onSummary: 'on',
  recipients: [{ id: 'acme', name: 'Acme Robotics', relationship: 'independent_controller' }],
  dataClasses: ['persona_selections', 'public_identity'],
  aggregatableFieldKeys: AGGREGATABLE_KEYS,
  policyVersion: '1',
};

const RECIPIENT_ID = 'acme';

// --- Fixture ----------------------------------------------------------------------

let db: DB;
let seq = 0;

interface SeedOptions {
  status?: 'active' | 'suspended';
  visibility?: 'public' | 'members' | 'private';
  deleted?: boolean;
  location?: string | null;
  displayName?: string;
  socialLinks?: Record<string, string> | null;
  /** Offset from the base timestamp, so ordering is deterministic. */
  createdOffsetMs?: number;
}

const BASE_CREATED = new Date('2026-01-01T00:00:00Z');

async function seedUser(opts: SeedOptions = {}): Promise<string> {
  const index = seq++;
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    // The one string this endpoint must never emit. Distinctive so the
    // no-email assertion below cannot pass by accident.
    email: `directory-${index}@members-directory.invalid`,
    username: `directory_${index}`,
    displayName: opts.displayName ?? `Directory ${index}`,
    headline: 'Builder of things',
    bio: 'A short bio',
    location: opts.location === undefined ? 'Lisbon' : opts.location,
    website: 'https://example.test/me',
    skills: ['soldering'],
    socialLinks: opts.socialLinks === undefined
      ? { github: 'https://github.com/example' }
      : (opts.socialLinks ?? undefined),
    status: opts.status ?? 'active',
    profileVisibility: opts.visibility ?? 'public',
    deletedAt: opts.deleted ? new Date() : null,
    createdAt: new Date(BASE_CREATED.getTime() + (opts.createdOffsetMs ?? index * 1000)),
  });
  return id;
}

async function grant(
  userId: string,
  purpose: ProcessingPurposeId,
  scopeDigest: string,
  opts: { state?: 'granted' | 'revoked'; supersededAt?: Date | null } = {},
): Promise<void> {
  await db.insert(userPurposeConsents).values({
    userId,
    purpose,
    state: opts.state ?? 'granted',
    scopeDigest,
    scopeSnapshot: SNAPSHOT,
    policyVersion: '1',
    source: 'settings',
    supersededAt: opts.supersededAt ?? null,
  });
}

async function answer(userId: string, fieldKey: string, values: string[]): Promise<void> {
  const sectionKey = fieldKey === 'interests' || fieldKey === 'tech_stack' ? fieldKey : 'basics';
  for (const value of values) {
    await db.insert(userPersonaAnswers).values({ userId, sectionKey, fieldKey, value });
  }
}

async function text(userId: string, fieldKey: string, value: string): Promise<void> {
  await db.insert(userPersonaText).values({ userId, sectionKey: 'basics', fieldKey, value });
}

/** Row present means the member shares that platform. Absent means they do not. */
async function share(userId: string, platform: string): Promise<void> {
  await db.insert(userSharedLinks).values({ userId, platform });
}

function input(overrides: Partial<ListOpenMembersInput> = {}): ListOpenMembersInput {
  return {
    audience: 'recruiters',
    scopeDigest: RECRUITER_DIGEST,
    sections: SECTIONS,
    linkPlatforms: BUILTIN_PERSONA_LINK_PLATFORMS,
    recipientId: RECIPIENT_ID,
    apiKeyId: null,
    ...overrides,
  };
}

function usernames(page: OpenMembersPage): string[] {
  return page.items.map((i) => i.username);
}

async function disclosureCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(disclosureEvents)
    .where(eq(disclosureEvents.userId, userId));
  return row?.n ?? 0;
}

async function clearDisclosures(): Promise<void> {
  await db.delete(disclosureEvents);
}

// --- Seeded cohorts ---------------------------------------------------------------

/** The member every positive assertion is about. */
let listedId: string;
/** A second listed member, for the filter tests. */
let listedTwoId: string;

interface Excluded {
  name: string;
  id: string;
}

const excluded: Excluded[] = [];

beforeAll(async () => {
  db = await createTestDB();

  listedId = await seedUser({
    displayName: 'Ada Listed',
    location: 'Lisbon',
    // Two platforms listed, ONE of them shared. The unshared one is the sharp
    // edge for every link assertion in this file.
    socialLinks: {
      github: 'https://github.com/example',
      instagram: 'https://instagram.com/private_account',
    },
    createdOffsetMs: 10_000,
  });
  await grant(listedId, 'recruiter_visibility', RECRUITER_DIGEST);
  await share(listedId, 'github');
  await answer(listedId, 'industry', ['software']);
  await answer(listedId, 'interests', ['rust', 'pcb_design']);
  await answer(listedId, 'tech_stack', ['vue']);
  await text(listedId, 'about_me', 'I build small robots.');
  // Never published, whatever anybody consents to.
  await text(listedId, 'health', 'a detail nobody outside gets to read');
  // Not on the public profile, and disclosed here on the strength of the grant.
  await text(listedId, 'off_profile_note', 'Mornings, headphones on.');

  listedTwoId = await seedUser({
    displayName: 'Grace Listed',
    location: 'Porto',
    socialLinks: { linkedin: 'https://linkedin.com/in/example' },
    createdOffsetMs: 20_000,
  });
  await grant(listedTwoId, 'recruiter_visibility', RECRUITER_DIGEST);
  await share(listedTwoId, 'linkedin');
  // An objection to STATISTICS. It must not touch this surface: objecting to
  // being counted is not withdrawing consent to be named, and treating one as
  // the other would silently revoke a grant the member still holds.
  await db.insert(userStatisticsObjections).values({ userId: listedTwoId });
  await answer(listedTwoId, 'industry', ['aerospace']);
  await answer(listedTwoId, 'interests', ['rust']);
  await answer(listedTwoId, 'tech_stack', ['postgres']);

  // Every way somebody must NOT appear. Each one is otherwise a perfectly
  // listable member with answers, so a broken predicate shows as an extra row.
  const cohorts: Array<[string, SeedOptions, (id: string) => Promise<void>]> = [
    // No consent row at all: nothing to inner join to.
    ['no_grant', {}, async () => {}],
    // Granted, then withdrawn. The old row is superseded; the current one refuses.
    [
      'revoked',
      {},
      async (id) => {
        await grant(id, 'recruiter_visibility', RECRUITER_DIGEST, {
          supersededAt: new Date('2026-01-02T00:00:00Z'),
        });
        await grant(id, 'recruiter_visibility', RECRUITER_DIGEST, { state: 'revoked' });
      },
    ],
    // A current grant carrying a digest the live scope has moved past.
    ['stale_digest', {}, async (id) => grant(id, 'recruiter_visibility', STALE_DIGEST)],
    // Granted the OTHER audience's purpose only.
    [
      'sponsor_only',
      {},
      async (id) => grant(id, 'sponsor_sharing', RECRUITER_DIGEST),
    ],
    [
      'private_profile',
      { visibility: 'private' },
      async (id) => grant(id, 'recruiter_visibility', RECRUITER_DIGEST),
    ],
    [
      'members_only_profile',
      { visibility: 'members' },
      async (id) => grant(id, 'recruiter_visibility', RECRUITER_DIGEST),
    ],
    [
      'suspended',
      { status: 'suspended' },
      async (id) => grant(id, 'recruiter_visibility', RECRUITER_DIGEST),
    ],
    [
      'soft_deleted',
      { deleted: true },
      async (id) => grant(id, 'recruiter_visibility', RECRUITER_DIGEST),
    ],
  ];

  for (const [name, opts, mutate] of cohorts) {
    const id = await seedUser(opts);
    await answer(id, 'industry', ['software']);
    await answer(id, 'interests', ['rust']);
    await mutate(id);
    excluded.push({ name, id });
  }
});

afterAll(async () => {
  await closeTestDB(db);
});

// --- Who is returned --------------------------------------------------------------

describe('listOpenMembers — the consent join', () => {
  it('returns exactly the members holding a current, digest-matching grant', async () => {
    const page = await listOpenMembers(db, input({ limit: DIRECTORY_LIMIT_MAX }));
    expect(page.items.map((i) => i.id).sort()).toEqual([listedId, listedTwoId].sort());
    expect(page.total).toBe(2);
    // Eight other members are seeded, each one listable but for a single fact.
    expect(usernames(page)).toHaveLength(2);
    expect(excluded).toHaveLength(8);
  });

  it.each([
    'no_grant',
    'revoked',
    'stale_digest',
    'sponsor_only',
    'private_profile',
    'members_only_profile',
    'suspended',
    'soft_deleted',
  ])('%s is absent', async (name) => {
    const cohort = excluded.find((e) => e.name === name);
    expect(cohort, `test setup: ${name} was not seeded`).toBeDefined();
    const page = await listOpenMembers(db, input({ limit: DIRECTORY_LIMIT_MAX }));
    expect(page.items.map((i) => i.id)).not.toContain(cohort!.id);
  });

  it('a member who objected to statistics is still listed (D2)', async () => {
    // The case a later reader is most likely to "fix" in one direction or the
    // other. An objection is a refusal of processing the instance does on its
    // own records; a grant is permission to be named to a third party. Treating
    // the objection as a withdrawal would revoke a consent the member still
    // holds, quietly, and they would never be told the toggle they pressed did
    // something else as well.
    const [objection] = await db
      .select({ userId: userStatisticsObjections.userId })
      .from(userStatisticsObjections)
      .where(eq(userStatisticsObjections.userId, listedTwoId));
    expect(objection?.userId, 'test setup: the objection was not seeded').toBe(listedTwoId);

    const page = await listOpenMembers(db, input({ limit: DIRECTORY_LIMIT_MAX }));
    expect(page.items.map((i) => i.id)).toContain(listedTwoId);
  });

  it('a digest that matches nobody returns an empty page and discloses nobody', async () => {
    await clearDisclosures();
    const page = await listOpenMembers(db, input({ scopeDigest: 'ffffffff' }));
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.disclosed).toBe(0);
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(0);
  });
});

// --- The payload ------------------------------------------------------------------

describe('listOpenMembers — projection', () => {
  it('carries no email anywhere in the serialised payload', async () => {
    const page = await listOpenMembers(db, input({ limit: DIRECTORY_LIMIT_MAX }));
    // Asserted on the JSON, not on the type: a type says what the compiler
    // believes, and this has to hold for whatever actually crosses the wire.
    const json = JSON.stringify(page);
    expect(json).not.toContain('members-directory.invalid');
    expect(json).not.toMatch(/email/i);
    expect(page.items.length).toBeGreaterThan(0);
  });

  it('publishes the public profile fields', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    expect(member.displayName).toBe('Ada Listed');
    expect(member.headline).toBe('Builder of things');
    expect(member.location).toBe('Lisbon');
    expect(member.website).toBe('https://example.test/me');
    // `recruiter_visibility` covers public_identity, location_coarse and
    // profile_links, so none of the per-class gates fire on this audience.
    expect(member.username).toMatch(/^directory_/);
  });

  it('sends only the link platforms the member chose to share', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    // GitHub is shared. Instagram is on the profile and is not.
    expect(member.socialLinks).toEqual({ github: 'https://github.com/example' });
    expect(JSON.stringify(page)).not.toContain('private_account');
  });

  it('sends no links at all for a member who shares none', async () => {
    // Seeded and torn down inside the test so the counts every other block
    // asserts on stay readable.
    const id = await seedUser({ displayName: 'Quiet Listed', createdOffsetMs: 30_000 });
    await grant(id, 'recruiter_visibility', RECRUITER_DIGEST);
    try {
      const page = await listOpenMembers(db, input({ limit: DIRECTORY_LIMIT_MAX }));
      const member = page.items.find((i) => i.id === id)!;
      expect(member, 'test setup: the member should be listed').toBeDefined();
      // `null` rather than `{}`: a recipient cannot tell "shares nothing" from
      // "has nothing", which is the correct amount to say.
      expect(member.socialLinks).toBeNull();
      // The row IS in the profile, so this is the sharing gate and not an empty
      // profile.
      const [row] = await db
        .select({ socialLinks: users.socialLinks })
        .from(users)
        .where(eq(users.id, id));
      expect(row?.socialLinks).toEqual({ github: 'https://github.com/example' });
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it('resolves persona answers to LABELS, never raw option values', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    const interests = member.persona.find((p) => p.fieldKey === 'interests')!;
    expect(interests.display).toBe('chips');
    expect(interests.values).toEqual(['PCB design', 'Rust']);
    expect(JSON.stringify(member.persona)).not.toContain('pcb_design');
  });

  it('publishes a public free-text answer', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    const about = member.persona.find((p) => p.fieldKey === 'about_me')!;
    expect(about.display).toBe('text');
    expect(about.values).toEqual(['I build small robots.']);
  });

  it('never publishes a sensitive field, whatever the member consented to', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    const keys = member.persona.map((p) => p.fieldKey);
    expect(keys).not.toContain('health');
    const json = JSON.stringify(page);
    expect(json).not.toContain('a detail nobody outside gets to read');
  });

  it('publishes an answer that is not on the public profile', async () => {
    // The visibility inversion does NOT narrow this endpoint, and the reasoning
    // is on `directoryProjectableFields`: the grant's copy names the answers
    // themselves rather than pointing at the profile, so a profile flag cannot
    // be what decides this. Carrying it across would list consenting members
    // with no answers at all on a default instance, and would leave the answer
    // FILTERS matching on fields the payload never prints.
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    const note = member.persona.find((p) => p.fieldKey === 'off_profile_note')!;
    expect(note.display).toBe('text');
    expect(note.values).toEqual(['Mornings, headphones on.']);
  });

  it('never repeats a column-bound or link field as a persona answer', async () => {
    const page = await listOpenMembers(db, input());
    const member = page.items.find((i) => i.id === listedId)!;
    const keys = member.persona.map((p) => p.fieldKey);
    expect(keys).not.toContain('display_name');
    expect(keys).not.toContain('link_github');
  });

  it('skips a drifted field key', async () => {
    const page = await listOpenMembers(db, input({ driftedFieldKeys: ['interests'] }));
    const member = page.items.find((i) => i.id === listedId)!;
    expect(member.persona.map((p) => p.fieldKey)).not.toContain('interests');
    expect(member.persona.map((p) => p.fieldKey)).toContain('tech_stack');
  });
});

describe('directoryProjectableFields', () => {
  it('publishes every non-sensitive answer field, in schema order', () => {
    const fields = directoryProjectableFields(SECTIONS).map((f) => f.fieldKey);
    expect(fields).toEqual(['industry', 'about_me', 'off_profile_note', 'interests', 'tech_stack']);
    // Column-bound, sensitive and link fields are the three structural skips.
    expect(fields).not.toContain('display_name');
    expect(fields).not.toContain('health');
    expect(fields).not.toContain('link_github');
  });

  it('drops a drifted key', () => {
    const fields = directoryProjectableFields(SECTIONS, ['industry']).map((f) => f.fieldKey);
    expect(fields).not.toContain('industry');
  });
});

// --- Filters ----------------------------------------------------------------------

describe('listOpenMembers — filters', () => {
  it('narrows on a single answer value', async () => {
    const page = await listOpenMembers(db, input({ filters: { industry: ['aerospace'] } }));
    expect(page.items.map((i) => i.id)).toEqual([listedTwoId]);
    expect(page.total).toBe(1);
  });

  it('ORs within one field', async () => {
    const page = await listOpenMembers(db, input({ filters: { industry: ['software', 'aerospace'] } }));
    expect(page.items.map((i) => i.id).sort()).toEqual([listedId, listedTwoId].sort());
  });

  it('ANDs across fields', async () => {
    const both = await listOpenMembers(db, input({
      filters: { interests: ['rust'], techStack: ['vue'] },
    }));
    expect(both.items.map((i) => i.id)).toEqual([listedId]);

    const impossible = await listOpenMembers(db, input({
      filters: { industry: ['aerospace'], techStack: ['vue'] },
    }));
    expect(impossible.items).toEqual([]);
    expect(impossible.total).toBe(0);
  });

  it('a filter never widens the set past the consent join', async () => {
    // The excluded cohorts all answered industry=software. If a filter were
    // applied as an OR, or the join were dropped, they would surface here.
    const page = await listOpenMembers(db, input({
      filters: { industry: ['software'] },
      limit: DIRECTORY_LIMIT_MAX,
    }));
    expect(page.items.map((i) => i.id)).toEqual([listedId]);
  });

  it('filters on link presence, ANDing the requested platforms', async () => {
    const github = await listOpenMembers(db, input({ filters: { hasLink: ['github'] } }));
    expect(github.items.map((i) => i.id)).toEqual([listedId]);

    const linkedin = await listOpenMembers(db, input({ filters: { hasLink: ['linkedin'] } }));
    expect(linkedin.items.map((i) => i.id)).toEqual([listedTwoId]);

    const both = await listOpenMembers(db, input({ filters: { hasLink: ['github', 'linkedin'] } }));
    expect(both.items).toEqual([]);
  });

  it('does not match a link the member listed but did not share', async () => {
    // A filter is a disclosure with one bit of resolution. Ada has an Instagram
    // address on her profile and did not share it; a recruiter who searches for
    // it and gets her back has learned the fact she withheld, even though the
    // payload would not have printed the address.
    const [row] = await db
      .select({ socialLinks: users.socialLinks })
      .from(users)
      .where(eq(users.id, listedId));
    expect(
      (row?.socialLinks as Record<string, string> | null)?.instagram,
      'test setup: the unshared link is missing',
    ).toContain('instagram.com');

    const instagram = await listOpenMembers(db, input({ filters: { hasLink: ['instagram'] } }));
    expect(instagram.items).toEqual([]);
    expect(instagram.total).toBe(0);

    // AND across platforms: the shared one alone is not enough either.
    const both = await listOpenMembers(db, input({
      filters: { hasLink: ['github', 'instagram'] },
    }));
    expect(both.items).toEqual([]);
  });

  it('filters on location, case-insensitively', async () => {
    const page = await listOpenMembers(db, input({ filters: { location: 'porto' } }));
    expect(page.items.map((i) => i.id)).toEqual([listedTwoId]);
  });

  it('treats a LIKE metacharacter in location as a literal', async () => {
    const page = await listOpenMembers(db, input({ filters: { location: '%' } }));
    expect(page.items).toEqual([]);
  });

  it('searches username and display name, as GET /users does', async () => {
    const page = await listOpenMembers(db, input({ filters: { q: 'Grace' } }));
    expect(page.items.map((i) => i.id)).toEqual([listedTwoId]);
  });

  it('refuses an unknown filter FIELD with a clean 400, never a raw bind', async () => {
    const withoutInterests = SECTIONS.filter((s) => s.key !== 'interests');
    await expect(
      listOpenMembers(db, input({ sections: withoutInterests, filters: { interests: ['rust'] } })),
    ).rejects.toMatchObject({ code: 'UNKNOWN_FILTER_FIELD', status: 400, field: 'interests' });
  });

  it('refuses an unknown filter VALUE with a clean 400', async () => {
    await expect(
      listOpenMembers(db, input({ filters: { interests: ["rust'; DROP TABLE users; --"] } })),
    ).rejects.toBeInstanceOf(MemberDirectoryError);
    // The refusal is not cosmetic: the table it named is still there.
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    expect(row?.n).toBeGreaterThan(0);
  });

  it('refuses a field whose answers live in the never-queried free-text sink', async () => {
    const sensitiveIndustry: PersonaSection[] = SECTIONS.map((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.key === 'industry' ? { ...f, sensitive: true } : f)),
    }));
    await expect(
      listOpenMembers(db, input({ sections: sensitiveIndustry, filters: { industry: ['software'] } })),
    ).rejects.toMatchObject({ code: 'FIELD_NOT_FILTERABLE', status: 400 });
  });

  it('refuses an unknown link platform', async () => {
    await expect(
      listOpenMembers(db, input({ filters: { hasLink: ['not_a_platform'] } })),
    ).rejects.toMatchObject({ code: 'UNKNOWN_LINK_PLATFORM', status: 400, field: 'hasLink' });
  });

  it('a refused request discloses nobody', async () => {
    await clearDisclosures();
    await expect(
      listOpenMembers(db, input({ filters: { hasLink: ['not_a_platform'] } })),
    ).rejects.toThrow();
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(0);
  });
});

// --- Pagination -------------------------------------------------------------------

describe('listOpenMembers — pagination', () => {
  it('caps the limit and floors the offset', async () => {
    const page = await listOpenMembers(db, input({ limit: 5000, offset: -3 }));
    expect(page.limit).toBe(DIRECTORY_LIMIT_MAX);
    expect(page.offset).toBe(0);
  });

  it('pages a tied ordering without repeating or skipping anybody', async () => {
    // Every one of these shares a created_at to the millisecond, which is what
    // a seeded instance or a bulk import produces. Without the unique `id`
    // tiebreaker the offset pages overlap, which on this surface means
    // disclosing one member twice and another never.
    const tied = new Date('2026-06-01T12:00:00Z');
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = await seedUser({ createdOffsetMs: tied.getTime() - BASE_CREATED.getTime() });
      await grant(id, 'recruiter_visibility', RECRUITER_DIGEST);
      ids.push(id);
    }

    const seen: string[] = [];
    for (let offset = 0; offset < 12; offset += 2) {
      const page = await listOpenMembers(db, input({ limit: 2, offset }));
      seen.push(...page.items.map((i) => i.id));
    }

    const tiedSeen = seen.filter((id) => ids.includes(id));
    expect(new Set(tiedSeen).size).toBe(tiedSeen.length);
    expect(new Set(tiedSeen)).toEqual(new Set(ids));

    // Clean up so the counts in the other blocks stay readable.
    for (const id of ids) await db.delete(users).where(eq(users.id, id));
  });

  it('reports hasMore against a real total', async () => {
    const first = await listOpenMembers(db, input({ limit: 1, offset: 0 }));
    expect(first.total).toBe(2);
    expect(first.hasMore).toBe(true);
    const last = await listOpenMembers(db, input({ limit: 1, offset: 1 }));
    expect(last.hasMore).toBe(false);
  });
});

// --- The disclosure audit ---------------------------------------------------------

describe('recordDisclosures', () => {
  it('writes exactly one row per member returned, in the same transaction', async () => {
    await clearDisclosures();
    const page = await listOpenMembers(db, input());
    expect(page.disclosed).toBe(page.items.length);

    for (const member of page.items) {
      expect(await disclosureCount(member.id)).toBe(1);
    }
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(page.items.length);
  });

  it('records the recipient, the purpose and the digest that authorised it', async () => {
    await clearDisclosures();
    await listOpenMembers(db, input());
    const rows = await db
      .select({
        recipientId: disclosureEvents.recipientId,
        purpose: disclosureEvents.purpose,
        scopeDigest: disclosureEvents.scopeDigest,
        apiKeyId: disclosureEvents.apiKeyId,
      })
      .from(disclosureEvents);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.recipientId).toBe(RECIPIENT_ID);
      expect(row.purpose).toBe('recruiter_visibility');
      expect(row.scopeDigest).toBe(RECRUITER_DIGEST);
      expect(row.apiKeyId).toBeNull();
    }
  });

  it('a repeat pull is a repeat disclosure, not an upsert', async () => {
    await clearDisclosures();
    await listOpenMembers(db, input());
    await listOpenMembers(db, input());
    expect(await disclosureCount(listedId)).toBe(2);
  });

  it('a failed write fails the request rather than disclosing unlogged', async () => {
    await clearDisclosures();
    // `recipient_id` is varchar(40). An over-long value is refused by the
    // database inside the read's transaction, so the request errors and nothing
    // is disclosed. The specific overflow is a stand-in for any insert failure.
    await expect(
      listOpenMembers(db, input({ recipientId: 'r'.repeat(64) })),
    ).rejects.toThrow();
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(0);
  });

  it('writes nothing for an empty member list', async () => {
    await clearDisclosures();
    const written = await recordDisclosures(db, {
      recipientId: RECIPIENT_ID,
      userIds: [],
      purpose: 'recruiter_visibility',
      scopeDigest: RECRUITER_DIGEST,
    });
    expect(written).toBe(0);
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(0);
  });
});

describe('listDisclosuresForMember', () => {
  it('groups per recipient with a count and the most recent time (D6)', async () => {
    await clearDisclosures();
    await listOpenMembers(db, input());
    await listOpenMembers(db, input());
    await listOpenMembers(db, input({ recipientId: 'globex' }));

    const seen = await listDisclosuresForMember(db, listedId);
    const byRecipient = new Map(seen.map((s) => [s.recipientId, s]));
    expect(byRecipient.get('acme')?.count).toBe(2);
    expect(byRecipient.get('globex')?.count).toBe(1);
    expect(byRecipient.get('acme')?.purpose).toBe('recruiter_visibility');
    expect(byRecipient.get('acme')?.lastDisclosedAt).toBeInstanceOf(Date);
  });

  it('is empty for a member nobody looked at', async () => {
    await clearDisclosures();
    const cohort = excluded.find((e) => e.name === 'no_grant')!;
    expect(await listDisclosuresForMember(db, cohort.id)).toEqual([]);
  });
});

// --- The audience gate ------------------------------------------------------------

describe('listOpenMembers — the covers gate', () => {
  it('refuses the sponsors audience, because sponsor_sharing does not cover identity', async () => {
    // Its copy reads "your interests, your tech stack and your public profile
    // links are shared with the sponsors named below": it never told anybody
    // their name, headline, bio or town would be handed over. Enabling this
    // audience is a `covers` edit AND a copy edit on the purpose, both of which
    // move the scope digest and re-ask everyone who already agreed.
    await expect(
      listOpenMembers(db, input({ audience: 'sponsors' })),
    ).rejects.toMatchObject({ code: 'PURPOSE_DOES_NOT_COVER_IDENTITY' });
  });

  it('discloses nobody when the audience is refused', async () => {
    await clearDisclosures();
    await expect(listOpenMembers(db, input({ audience: 'sponsors' }))).rejects.toThrow();
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(disclosureEvents);
    expect(row?.n).toBe(0);
  });
});

// --- D1: the isolation sweep ------------------------------------------------------

describe('directory and metrics isolation (D1)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const personaDir = resolve(here, '../persona');
  const files = ['directory.ts', 'metrics.ts'];

  /**
   * Comments stripped, so the sweep reads what the file DOES.
   *
   * Without this, the paragraph in `directory.ts` explaining that it applies no
   * k-anonymity fails the assertion that it applies no k-anonymity, and the
   * obvious fix (delete the explanation) removes the one thing telling the next
   * reader why the floor is missing.
   */
  function code(file: string): string {
    return readFileSync(resolve(personaDir, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  it('walked both modules', () => {
    // A sweep with a broken path reads zero files and passes. The guard asserts
    // it read what it claims to have read, that each file is real source, and
    // that stripping comments left executable code behind.
    let walked = 0;
    for (const file of files) {
      const source = readFileSync(resolve(personaDir, file), 'utf8');
      expect(source.length).toBeGreaterThan(1000);
      expect(code(file).length).toBeGreaterThan(500);
      walked++;
    }
    expect(walked).toBe(2);
  });

  /**
   * Every specifier the module names, static OR dynamic.
   *
   * A sweep that only reads `from '...'` is defeated by `await import('./metrics.js')`,
   * which is the exact shape somebody reaches for when a static import feels wrong,
   * and it is the shape that would smuggle the k-anonymity floor into the directory
   * (or the directory's unsuppressed read into the aggregates) without tripping this
   * file. Both quote styles, both forms.
   */
  function specifiers(file: string): string[] {
    const body = code(file);
    return [
      ...[...body.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!),
      ...[...body.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
      ...[...body.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
    ];
  }

  it('directory.ts does not import metrics.ts, statically or dynamically', () => {
    const imports = specifiers('directory.ts');
    expect(imports.length).toBeGreaterThan(3);
    expect(imports).not.toContain('./metrics.js');
    expect(imports.some((i) => i.includes('metrics'))).toBe(false);
  });

  it('metrics.ts does not import directory.ts, statically or dynamically', () => {
    const imports = specifiers('metrics.ts');
    expect(imports.length).toBeGreaterThan(3);
    expect(imports).not.toContain('./directory.js');
    expect(imports.some((i) => i.includes('directory'))).toBe(false);
  });

  it('the specifier sweep can see a dynamic import at all', () => {
    // The positive control. Without it, a regex that matched nothing would make
    // both isolation assertions above pass for the wrong reason, forever.
    const probe = `await import('./metrics.js'); const x = require("./directory.js");`;
    const found = [
      ...[...probe.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
      ...[...probe.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
    ];
    expect(found).toEqual(['./metrics.js', './directory.js']);
  });

  it('the directory applies no k-anonymity, and says why', () => {
    // Not a style check. A floor, a HAVING or a quantiser in this module's CODE
    // means somebody suppressed a list of consenting people, which returns an
    // empty directory and then reads as a bug in the consent join.
    const body = code('directory.ts');
    expect(body).not.toMatch(/minBucket|MIN_AUDIENCE_POPULATION|METRICS_MIN_BUCKET/);
    expect(body).not.toMatch(/quantise|having/i);
    // And the prose saying so is still there, so the next reader is told.
    expect(readFileSync(resolve(personaDir, 'directory.ts'), 'utf8')).toContain('D1');
  });

  it('the aggregates keep their k-anonymity', () => {
    const body = code('metrics.ts');
    expect(body).toContain('count(*) >= ');
    expect(body).toContain('quantisePersonaCount');
  });
});
