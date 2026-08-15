import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { users, userPurposeConsents } from '@commonpub/schema';
import type { PurposeScopeSnapshot } from '@commonpub/schema';
import {
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  type ProcessingPurposeId,
  renderPurposeOnSummary,
} from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  OFFERED_PROCESSING_PURPOSES,
  PURPOSE_SCOPE_SNAPSHOT_CAPS,
  PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES,
  PurposeConsentConflictError,
  PurposeNotOfferedError,
  PurposeScopeChangedError,
  PurposeScopeSnapshotTooLargeError,
  type PurposeScope,
  type PurposeScopeConfig,
  assertPurposeScopeSnapshot,
  buildPurposeScopeSnapshot,
  currentPurposeScope,
  deferredProcessingPurposes,
  effectivePurposeGrant,
  getPurposeConsentState,
  listPurposeConsentHistory,
  recordPurposeConsent,
} from '../persona/consent.js';

// Plan section 10.3, `purposeConsent.integration.test.ts`, minus every case about
// `consent_proofs` (no such table in v1, section 14.5) and about `user_consents`
// audit rows (deliberately not written, section 14.4).
//
// REVISED for the corrected model (plan revisions 2 and 3). `profile_analytics`
// is gone, so the registry is exactly the two NAMED THIRD-PARTY purposes and
// both of them require a recipient. The consequence runs through every case
// here and is the point rather than an inconvenience: an instance that has
// declared nobody offers NOTHING, and its members are asked nothing. The old
// suite could grant on a bare config because the analytics purpose needed no
// recipient; a scope with a declared recipient is now the precondition for
// every write test.

/** A processor covering ONE purpose, so the other stays unofferable on purpose. */
const RECIPIENT = {
  id: 'contoso',
  name: 'Contoso Tools',
  privacyPolicyUrl: 'https://contoso.example/privacy',
  purposes: ['sponsor_sharing'],
  relationship: 'processor',
};

/** The config an instance that actually discloses to somebody has. */
const SHARING_CONFIG = { dataSharing: { recipients: [RECIPIENT] } } as PurposeScopeConfig;

async function currentRows(db: DB, userId: string) {
  return db
    .select()
    .from(userPurposeConsents)
    .where(
      and(eq(userPurposeConsents.userId, userId), isNull(userPurposeConsents.supersededAt)),
    );
}

describe('the purpose registry after profile_analytics was removed', () => {
  it('holds exactly the two named third-party purposes, and no statistics purpose', () => {
    expect([...PROCESSING_PURPOSES].sort()).toEqual(['recruiter_visibility', 'sponsor_sharing']);
    // The removed id, by name, so this fails if anybody puts it back.
    expect([...PROCESSING_PURPOSES] as string[]).not.toContain('profile_analytics');
  });

  /**
   * The registry is a registry of DISCLOSURES, and this is the property that
   * keeps it one. Statistics are processing the instance does on its own records
   * under legitimate interest; the member's instrument is the objection in
   * `objections.ts`. A purpose readmitted under another name (`instance_metrics`,
   * `community_counts`) would re-create the dark pattern the correction removed,
   * so the assertion is on the SHAPE and not only on the deleted string.
   */
  it('every purpose discloses to named recipients, on consent, defaulting off', () => {
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(spec.disclosedTo).toBe('named_recipients');
      expect(spec.legalBasis).toBe('consent');
      expect(spec.defaultGranted).toBe(false);
      expect(spec.requiresRecipients).toBe(true);
      expect(id).not.toMatch(/analytic|statistic|metric|count/i);
    }
    expect(PROCESSING_PURPOSES.length).toBe(2);
  });

  it('the offered set is the whole registry and nothing outside it', () => {
    expect([...OFFERED_PROCESSING_PURPOSES].sort()).toEqual([...PROCESSING_PURPOSES].sort());
    for (const id of OFFERED_PROCESSING_PURPOSES) {
      expect([...PROCESSING_PURPOSES] as string[]).toContain(id);
    }
  });
});

describe('currentPurposeScope', () => {
  let db: DB;

  beforeAll(async () => { db = await createTestDB(); });
  afterAll(async () => { await closeTestDB(db); });

  /**
   * The makerspace case (plan R2.3) as an assertion. An operator can run persona
   * for purely operational questions with no recruiter and no sponsor, and then
   * there is nothing to ask about: no offerable purpose, no data class in the
   * digest, and a member-facing page with no sharing section at all.
   */
  it('offers NOTHING on an instance that has declared no recipient', async () => {
    const scope = await currentPurposeScope(db, {});
    expect(scope.offerablePurposes).toEqual([]);
    expect(scope.dataClasses).toEqual([]);
    expect(scope.recipients).toEqual([]);
    // Both purposes are named as deferred rather than vanishing, so a surface
    // CAN say why it is empty. It still renders nothing here.
    expect(deferredProcessingPurposes(scope.offerablePurposes).map((d) => d.purpose).sort())
      .toEqual([...PROCESSING_PURPOSES].sort());
  });

  it('offers a purpose once a papered recipient covers it, and only that one', async () => {
    const scope = await currentPurposeScope(db, SHARING_CONFIG);
    expect(scope.offerablePurposes).toEqual(['sponsor_sharing']);
    expect(deferredProcessingPurposes(scope.offerablePurposes)).toEqual([
      { purpose: 'recruiter_visibility', label: PROCESSING_PURPOSE_SPECS.recruiter_visibility.label },
    ]);
  });

  it('offers both once one recipient covers both', async () => {
    const scope = await currentPurposeScope(db, {
      dataSharing: {
        recipients: [
          {
            id: 'acme',
            name: 'Acme Robotics',
            privacyPolicyUrl: 'https://acme.example/privacy',
            purposes: ['recruiter_visibility', 'sponsor_sharing'],
            relationship: 'independent_controller',
            agreementRef: 'https://acme.example/dpa',
          },
        ],
      },
    } as PurposeScopeConfig);
    expect(scope.offerablePurposes).toEqual(['recruiter_visibility', 'sponsor_sharing']);
    expect(deferredProcessingPurposes(scope.offerablePurposes)).toEqual([]);
  });

  it('refuses both when the covering recipient is unpapered', async () => {
    // An independent controller with no `agreementRef` is an undocumented
    // onward transfer. Listing a purpose in the offered constant must not become
    // a way to deploy past one.
    const scope = await currentPurposeScope(db, {
      dataSharing: {
        recipients: [
          {
            id: 'acme',
            name: 'Acme Robotics',
            privacyPolicyUrl: 'https://acme.example/privacy',
            purposes: ['recruiter_visibility', 'sponsor_sharing'],
            relationship: 'independent_controller',
          },
        ],
      },
    } as PurposeScopeConfig);
    expect(scope.offerablePurposes).toEqual([]);
  });

  /**
   * There is no countable-field gate any more. It existed for
   * `profile_analytics`, whose card was about counting; a CONSENT card about
   * disclosure cannot be withheld on the grounds that there is nothing countable
   * yet. A template with no aggregatable field at all still offers the purpose.
   */
  it('offers a purpose even when no field is aggregatable', async () => {
    const scope = await currentPurposeScope(db, SHARING_CONFIG, {
      sections: async () => [
        { key: 'ops', label: 'Ops', fields: [{ key: 'bio', label: 'Bio', type: 'textarea' }] },
      ],
    });
    expect(scope.aggregatableFieldKeys).toEqual([]);
    expect(scope.offerablePurposes).toEqual(['sponsor_sharing']);
  });

  it('derives the aggregatable field keys from the built-in sections, sorted', async () => {
    const scope = await currentPurposeScope(db, {});
    expect(scope.aggregatableFieldKeys).toEqual(['industry', 'interests', 'tech_stack']);
    // Free text and column-bound fields are never countable, so they are absent.
    expect(scope.aggregatableFieldKeys).not.toContain('bio');
    expect(scope.aggregatableFieldKeys).not.toContain('link_github');
  });

  it('digests only the OFFERABLE purposes\' data classes', async () => {
    const bare = await currentPurposeScope(db, {});
    expect(bare.dataClasses).toEqual([]);

    const scope = await currentPurposeScope(db, SHARING_CONFIG);
    // sponsor_sharing alone is offerable, so recruiter-only classes stay out.
    expect(scope.dataClasses).toEqual(
      [...PROCESSING_PURPOSE_SPECS.sponsor_sharing.covers].sort(),
    );
    expect(scope.dataClasses).not.toContain('public_identity');
  });

  it('changes the digest when a recipient is declared', async () => {
    const before = await currentPurposeScope(db, {});
    const after = await currentPurposeScope(db, SHARING_CONFIG);
    expect(after.recipients).toHaveLength(1);
    expect(after.digest).not.toBe(before.digest);
  });

  it('changes the digest when an aggregatable field is added', async () => {
    const before = await currentPurposeScope(db, {});
    const after = await currentPurposeScope(db, {}, {
      sections: async () => [
        {
          key: 'extra',
          label: 'Extra',
          fields: [
            { key: 'industry', label: 'Industry', type: 'select', options: [{ value: 'a', label: 'A' }] },
            { key: 'shift', label: 'Shift', type: 'select', options: [{ value: 'night', label: 'Night' }] },
          ],
        },
      ],
    });
    expect(after.aggregatableFieldKeys).toEqual(['industry', 'shift']);
    // The field keys still bind the digest: a grant SENDS the member's
    // selections to a named third party, so which selections exist is part of
    // what leaves, not merely part of what was once tallied.
    expect(after.digest).not.toBe(before.digest);
  });

  it('is stable against declaration order', async () => {
    const a = await currentPurposeScope(db, {}, {
      sections: async () => [
        { key: 's', label: 'S', fields: [
          { key: 'b_field', label: 'B', type: 'select', options: [{ value: 'x', label: 'X' }] },
          { key: 'a_field', label: 'A', type: 'select', options: [{ value: 'x', label: 'X' }] },
        ] },
      ],
    });
    const b = await currentPurposeScope(db, {}, {
      sections: async () => [
        { key: 's', label: 'S', fields: [
          { key: 'a_field', label: 'A', type: 'select', options: [{ value: 'x', label: 'X' }] },
          { key: 'b_field', label: 'B', type: 'select', options: [{ value: 'x', label: 'X' }] },
        ] },
      ],
    });
    expect(a.digest).toBe(b.digest);
  });

  it('falls back to the built-in sections rather than throwing on a malformed persona config', async () => {
    const scope = await currentPurposeScope(db, { persona: { sections: 'not an array' } });
    // A config typo must not make it impossible to REVOKE consent.
    expect(scope.aggregatableFieldKeys).toEqual(['industry', 'interests', 'tech_stack']);
  });

  it('treats a malformed dataSharing document as no recipients', async () => {
    const scope = await currentPurposeScope(db, {
      dataSharing: { recipients: [{ id: 'x' }] },
    });
    expect(scope.recipients).toEqual([]);
    expect(scope.offerablePurposes).toEqual([]);
    expect(scope.minBucket).toBe(5);
    expect(scope.minPopulation).toBe(25);
  });

  it('does not offer a purpose whose only recipient is an unpapered controller', async () => {
    const scope = await currentPurposeScope(
      db,
      {
        dataSharing: {
          recipients: [{ ...RECIPIENT, purposes: ['sponsor_sharing'], relationship: 'independent_controller' }],
        },
      },
      { offeredPurposes: ['sponsor_sharing'] },
    );
    expect(scope.offerablePurposes).toEqual([]);
  });
});

describe('effectivePurposeGrant (plan section 6.5)', () => {
  it('authorises a grant whose digest matches', () => {
    expect(effectivePurposeGrant({ state: 'granted', scopeDigest: 'abc' }, 'abc'))
      .toEqual({ authorised: true, needsReconfirmation: false });
  });

  it('a stale grant authorises NOTHING and asks passively', () => {
    expect(effectivePurposeGrant({ state: 'granted', scopeDigest: 'old' }, 'new'))
      .toEqual({ authorised: false, needsReconfirmation: true });
  });

  it('a revocation is never re-asked, whatever the digest', () => {
    expect(effectivePurposeGrant({ state: 'revoked', scopeDigest: 'abc' }, 'abc'))
      .toEqual({ authorised: false, needsReconfirmation: false });
    expect(effectivePurposeGrant({ state: 'revoked', scopeDigest: 'old' }, 'new'))
      .toEqual({ authorised: false, needsReconfirmation: false });
  });

  it('an absent record is not consent, and is not a question either', () => {
    expect(effectivePurposeGrant(null, 'abc'))
      .toEqual({ authorised: false, needsReconfirmation: false });
    expect(effectivePurposeGrant(undefined, 'abc'))
      .toEqual({ authorised: false, needsReconfirmation: false });
  });

  it('fails closed on a state string it does not recognise', () => {
    expect(effectivePurposeGrant({ state: 'pending', scopeDigest: 'abc' }, 'abc'))
      .toEqual({ authorised: false, needsReconfirmation: false });
  });
});

describe('buildPurposeScopeSnapshot bounds (plan section 6.4)', () => {
  let db: DB;
  let scope: PurposeScope;

  beforeAll(async () => {
    db = await createTestDB();
    scope = await currentPurposeScope(db, SHARING_CONFIG);
  });
  afterAll(async () => { await closeTestDB(db); });

  it('records the copy verbatim from the registry', () => {
    const snap = buildPurposeScopeSnapshot('sponsor_sharing', scope);
    const spec = PROCESSING_PURPOSE_SPECS.sponsor_sharing;
    expect(snap.purposeLabel).toBe(spec.label);
    expect(snap.offSummary).toBe(spec.offSummary);
    // The ON copy is stored RENDERED, because that is the sentence the member
    // read. Storing the template would put a literal `{minBucket}` into the
    // Art. 7(1) record.
    expect(snap.onSummary).toBe(renderPurposeOnSummary('sponsor_sharing', scope));
    expect(snap.policyVersion).toBe(scope.policyVersion);
    expect(snap.aggregatableFieldKeys).toEqual(scope.aggregatableFieldKeys);
    expect(snap.dataClasses).toEqual([...spec.covers]);
  });

  /**
   * Neither surviving purpose names a k-anonymity floor: both disclose one named
   * member to one named recipient, and a floor over a group has nothing to say
   * about that. The floors moved to the statistics copy, which is not consent
   * and is not stored here.
   *
   * The render still goes through the one renderer, and this is what pins that:
   * no unsubstituted token can reach the stored record at ANY floor setting, so
   * a future purpose that does name one cannot store `{minBucket}` as the
   * evidence of what a member was shown.
   */
  it('stores a finished sentence, never a template, at any floor setting', async () => {
    for (const minBucket of [5, 25]) {
      const at = await currentPurposeScope(db, {
        dataSharing: { recipients: [RECIPIENT], minBucket },
      } as PurposeScopeConfig);
      expect(at.minBucket).toBe(minBucket);
      const snap = buildPurposeScopeSnapshot('sponsor_sharing', at);
      expect(snap.onSummary).toBe(renderPurposeOnSummary('sponsor_sharing', at));
      expect(snap.onSummary).not.toMatch(/[{}]/);
      expect(snap.offSummary).not.toMatch(/[{}]/);
    }
  });

  it('records only the recipients of THIS purpose', () => {
    // The recipient covers sponsor_sharing, so a recruiter snapshot names nobody.
    expect(buildPurposeScopeSnapshot('recruiter_visibility', scope).recipients).toEqual([]);
    expect(buildPurposeScopeSnapshot('sponsor_sharing', scope).recipients).toEqual([
      { id: 'contoso', name: 'Contoso Tools', relationship: 'processor' },
    ]);
  });

  it('serialises a WORST CASE snapshot under the byte budget', () => {
    const key = 'k'.repeat(PURPOSE_SCOPE_SNAPSHOT_CAPS.fieldKey);
    const worst: PurposeScope = {
      ...scope,
      // 20 recipients at their maximum field lengths, plus the maximum number of
      // maximum-length aggregatable field keys, is the biggest snapshot a real
      // instance can produce.
      recipients: Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`.padEnd(PURPOSE_SCOPE_SNAPSHOT_CAPS.recipientId, 'x'),
        name: 'n'.repeat(PURPOSE_SCOPE_SNAPSHOT_CAPS.recipientName),
        privacyPolicyUrl: 'https://example.com/privacy',
        purposes: ['recruiter_visibility'] as const,
        relationship: 'independent_controller' as const,
        agreementRef: 'ref',
      })).map((r) => ({ ...r, purposes: [...r.purposes] })),
      aggregatableFieldKeys: Array.from(
        { length: PURPOSE_SCOPE_SNAPSHOT_CAPS.aggregatableFieldKeys },
        (_, i) => `${i}`.padEnd(PURPOSE_SCOPE_SNAPSHOT_CAPS.fieldKey, 'k'),
      ),
      policyVersion: 'v'.repeat(PURPOSE_SCOPE_SNAPSHOT_CAPS.policyVersion),
    };
    const snap = buildPurposeScopeSnapshot('recruiter_visibility', worst);
    const bytes = Buffer.byteLength(JSON.stringify(snap), 'utf8');
    expect(bytes).toBeLessThanOrEqual(PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES);
    // The budget was met by dropping field keys, never recipients or copy.
    expect(snap.recipients).toHaveLength(20);
    expect(snap.aggregatableFieldKeys.length).toBeLessThan(
      PURPOSE_SCOPE_SNAPSHOT_CAPS.aggregatableFieldKeys,
    );
    expect(key.length).toBe(PURPOSE_SCOPE_SNAPSHOT_CAPS.fieldKey);
  });

  it('a snapshot with no field keys to drop and too many recipients throws, never truncates the disclosure', () => {
    const absurd: PurposeScope = {
      ...scope,
      recipients: Array.from({ length: 50 }, (_, i) => ({
        id: `r${i}`.padEnd(PURPOSE_SCOPE_SNAPSHOT_CAPS.recipientId, 'x'),
        name: 'n'.repeat(PURPOSE_SCOPE_SNAPSHOT_CAPS.recipientName),
        privacyPolicyUrl: 'https://example.com/privacy',
        purposes: ['recruiter_visibility'],
        relationship: 'processor' as const,
      })),
      aggregatableFieldKeys: [],
    };
    expect(() => buildPurposeScopeSnapshot('recruiter_visibility', absurd))
      .toThrow(PurposeScopeSnapshotTooLargeError);
  });

  it('rejects a snapshot carrying operator paperwork it was never shown', () => {
    const leaky = {
      purposeLabel: 'x', offSummary: 'x', onSummary: 'x', policyVersion: '1',
      recipients: [{ id: 'a', name: 'A', relationship: 'processor', agreementRef: 'secret-contract' }],
      dataClasses: [], aggregatableFieldKeys: [],
    };
    expect(() => assertPurposeScopeSnapshot(leaky)).toThrow(/beyond id, name and relationship/);
  });

  it('rejects an over-long label and a non-array recipients list', () => {
    const base = {
      purposeLabel: 'x', offSummary: 'x', onSummary: 'x', policyVersion: '1',
      recipients: [], dataClasses: [], aggregatableFieldKeys: [],
    };
    expect(() => assertPurposeScopeSnapshot({ ...base, purposeLabel: 'x'.repeat(121) }))
      .toThrow(/purposeLabel/);
    expect(() => assertPurposeScopeSnapshot({ ...base, recipients: 'nope' }))
      .toThrow(/recipients must be an array/);
    expect(() => assertPurposeScopeSnapshot({ ...base, policyVersion: '' }))
      .toThrow(/policyVersion is empty/);
  });
});

describe('recordPurposeConsent (plan sections 6.4, 6.5)', () => {
  let db: DB;
  let scope: PurposeScope;

  beforeAll(async () => {
    db = await createTestDB();
    scope = await currentPurposeScope(db, SHARING_CONFIG);
  });
  afterAll(async () => { await closeTestDB(db); });

  async function freshUser(tag: string): Promise<string> {
    return (await createTestUser(db, { username: `pc-${tag}-${Date.now()}` })).id;
  }

  function act(userId: string, grant: boolean) {
    return recordPurposeConsent(db, {
      userId,
      purpose: 'sponsor_sharing',
      grant,
      scopeDigest: scope.digest,
      scope,
      source: 'settings',
      ip: '203.0.113.9',
      userAgent: 'TestAgent/1.0',
    });
  }

  /**
   * The deleted purpose as a RUNTIME assertion, not only a type one. The type
   * union already rejects it at compile time, but a route reads its purpose off
   * an HTTP body, so the string can still arrive; `isProcessingPurposeId` is
   * what stops it becoming a row.
   */
  it('refuses the removed profile_analytics purpose as an unknown purpose', async () => {
    const userId = await freshUser('removed');
    for (const grant of [true, false]) {
      const err = await recordPurposeConsent(db, {
        userId,
        purpose: 'profile_analytics' as ProcessingPurposeId,
        grant,
        scopeDigest: scope.digest,
        scope,
        source: 'api',
      }).catch((e: unknown) => e as PurposeNotOfferedError);
      expect(err).toBeInstanceOf(PurposeNotOfferedError);
      expect(err.status).toBe(404);
    }
    expect(await currentRows(db, userId)).toHaveLength(0);
  });

  it('grant, revoke, grant writes THREE rows and leaves exactly one current', async () => {
    const userId = await freshUser('history');
    await act(userId, true);
    await act(userId, false);
    await act(userId, true);

    const all = await db
      .select()
      .from(userPurposeConsents)
      .where(eq(userPurposeConsents.userId, userId));
    expect(all).toHaveLength(3);
    // This is the case `recordConsent` cannot express: its version-only dedup
    // would have collapsed all three into one row.
    expect(all.map((r) => r.state).sort()).toEqual(['granted', 'granted', 'revoked']);

    const current = await currentRows(db, userId);
    expect(current).toHaveLength(1);
    expect(current[0]!.state).toBe('granted');
    expect(all.filter((r) => r.supersededAt !== null)).toHaveLength(2);
  });

  it('a no-op toggle writes NOTHING', async () => {
    const userId = await freshUser('noop');
    const first = await act(userId, true);
    expect(first.written).toBe(true);

    const second = await act(userId, true);
    expect(second.written).toBe(false);
    expect(second.consentId).toBe(first.consentId);

    const all = await db
      .select()
      .from(userPurposeConsents)
      .where(eq(userPurposeConsents.userId, userId));
    expect(all).toHaveLength(1);
  });

  it('records the IP, the user agent, the source and the snapshot', async () => {
    const userId = await freshUser('audit');
    await act(userId, true);
    const [row] = await currentRows(db, userId);
    expect(row!.ipAddress).toBe('203.0.113.9');
    expect(row!.userAgent).toBe('TestAgent/1.0');
    expect(row!.source).toBe('settings');
    expect(row!.scopeDigest).toBe(scope.digest);
    const snap = row!.scopeSnapshot as PurposeScopeSnapshot;
    expect(snap.purposeLabel).toBe(PROCESSING_PURPOSE_SPECS.sponsor_sharing.label);
    expect(snap.aggregatableFieldKeys).toEqual(scope.aggregatableFieldKeys);
    // The recipient the member was actually shown, by name.
    expect(snap.recipients).toEqual([
      { id: 'contoso', name: 'Contoso Tools', relationship: 'processor' },
    ]);
  });

  it('every stored value fits its column', async () => {
    const userId = await freshUser('columns');
    await act(userId, true);
    const [row] = await currentRows(db, userId);
    expect(row!.purpose.length).toBeLessThanOrEqual(24);
    expect(row!.state.length).toBeLessThanOrEqual(16);
    expect(row!.scopeDigest.length).toBeLessThanOrEqual(16);
    expect(row!.policyVersion.length).toBeLessThanOrEqual(32);
    expect(row!.source.length).toBeLessThanOrEqual(24);
    // Every purpose id, not only the one this test wrote.
    for (const id of PROCESSING_PURPOSES) expect(id.length).toBeLessThanOrEqual(24);
  });

  it('refuses a grant recorded against a digest the user was not shown', async () => {
    const userId = await freshUser('stale');
    await expect(recordPurposeConsent(db, {
      userId,
      purpose: 'sponsor_sharing',
      grant: true,
      scopeDigest: 'stale123',
      scope,
      source: 'settings',
    })).rejects.toBeInstanceOf(PurposeScopeChangedError);

    expect(await currentRows(db, userId)).toHaveLength(0);
  });

  it('surfaces the scope change as a NON-retryable 409 carrying both digests', async () => {
    const userId = await freshUser('stale409');
    const err = await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: true,
      scopeDigest: 'stale123', scope, source: 'settings',
    }).catch((e: unknown) => e as PurposeScopeChangedError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('SCOPE_CHANGED');
    expect(err.retryable).toBe(false);
    expect(err.expectedScopeDigest).toBe(scope.digest);
    expect(err.receivedScopeDigest).toBe('stale123');
  });

  it('refuses a GRANT for a purpose this instance does not offer, with a 404', async () => {
    const userId = await freshUser('notoffered');
    // No recipient covers recruiter_visibility in this scope.
    const err = await recordPurposeConsent(db, {
      userId, purpose: 'recruiter_visibility', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    }).catch((e: unknown) => e as PurposeNotOfferedError);
    expect(err).toBeInstanceOf(PurposeNotOfferedError);
    expect(err.status).toBe(404);
  });

  it('ALLOWS a withdrawal of a purpose that stopped being offered', async () => {
    const userId = await freshUser('withdraw');
    const result = await recordPurposeConsent(db, {
      userId, purpose: 'recruiter_visibility', grant: false,
      scopeDigest: scope.digest, scope, source: 'settings',
    });
    // A config change must never be able to trap a user in a grant.
    expect(result.written).toBe(true);
    expect(result.state).toBe('revoked');
  });

  it('maps a unique violation on uq_purpose_current to a RETRYABLE 409, never a 500', async () => {
    const violation = Object.assign(
      new Error('duplicate key value violates unique constraint "uq_purpose_current"'),
      { code: '23505' },
    );
    const racingDb = {
      transaction: async () => { throw violation; },
    } as unknown as DB;

    const err = await recordPurposeConsent(racingDb, {
      userId: '00000000-0000-0000-0000-000000000001',
      purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    }).catch((e: unknown) => e as PurposeConsentConflictError);

    expect(err).toBeInstanceOf(PurposeConsentConflictError);
    expect(err.status).toBe(409);
    expect(err.retryable).toBe(true);
  });

  it('does not swallow an unrelated failure', async () => {
    const brokenDb = {
      transaction: async () => { throw new Error('connection terminated'); },
    } as unknown as DB;
    await expect(recordPurposeConsent(brokenDb, {
      userId: '00000000-0000-0000-0000-000000000001',
      purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    })).rejects.toThrow('connection terminated');
  });

  it('the partial unique index really does reject a second current row', async () => {
    const userId = await freshUser('index');
    await act(userId, true);
    const [row] = await currentRows(db, userId);
    await expect(db.insert(userPurposeConsents).values({
      userId,
      purpose: 'sponsor_sharing',
      state: 'granted',
      scopeDigest: scope.digest,
      scopeSnapshot: row!.scopeSnapshot,
      policyVersion: scope.policyVersion,
      source: 'api',
    })).rejects.toThrow();

    // ...and it permits a second SUPERSEDED row, which is what the history needs.
    await db.insert(userPurposeConsents).values({
      userId,
      purpose: 'sponsor_sharing',
      state: 'revoked',
      scopeDigest: scope.digest,
      scopeSnapshot: row!.scopeSnapshot,
      policyVersion: scope.policyVersion,
      source: 'api',
      supersededAt: new Date(),
    });
    expect(await currentRows(db, userId)).toHaveLength(1);
  });

  it('deleting the account leaves zero rows, with no erasure code of its own', async () => {
    const userId = await freshUser('erase');
    await act(userId, true);
    await act(userId, false);
    expect(
      (await db.select().from(userPurposeConsents).where(eq(userPurposeConsents.userId, userId))),
    ).toHaveLength(2);

    await db.delete(users).where(eq(users.id, userId));

    // Section 14.5: the cascade on users.id is the whole erasure story in v1.
    // There is no consent_proofs tombstone, because there is no onward
    // disclosure in v1 for such a proof to defend.
    expect(
      (await db.select().from(userPurposeConsents).where(eq(userPurposeConsents.userId, userId))),
    ).toHaveLength(0);
  });
});

describe('getPurposeConsentState', () => {
  let db: DB;
  let scope: PurposeScope;

  beforeAll(async () => {
    db = await createTestDB();
    scope = await currentPurposeScope(db, SHARING_CONFIG);
  });
  afterAll(async () => { await closeTestDB(db); });

  it('returns a row per purpose, absent included, for a user who never acted', async () => {
    const userId = (await createTestUser(db, { username: `st-none-${Date.now()}` })).id;
    const state = await getPurposeConsentState(db, userId, { scopeDigest: scope.digest });
    expect(state.map((s) => s.purpose)).toEqual([...PROCESSING_PURPOSES]);
    for (const entry of state) {
      expect(entry.state).toBe('absent');
      expect(entry.authorised).toBe(false);
      expect(entry.needsReconfirmation).toBe(false);
      expect(entry.actedAt).toBeNull();
      expect(entry.scopeSnapshot).toBeNull();
    }
  });

  it('authorises a live grant and de-authorises it when the scope moves', async () => {
    const userId = (await createTestUser(db, { username: `st-grant-${Date.now()}` })).id;
    await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    });

    const live = await getPurposeConsentState(db, userId, {
      scopeDigest: scope.digest,
      purposes: ['sponsor_sharing'],
    });
    expect(live[0]!.state).toBe('granted');
    expect(live[0]!.authorised).toBe(true);
    expect(live[0]!.needsReconfirmation).toBe(false);
    expect(live[0]!.actedAt).toBeInstanceOf(Date);

    const moved = await getPurposeConsentState(db, userId, {
      scopeDigest: 'somethingelse',
      purposes: ['sponsor_sharing'],
    });
    expect(moved[0]!.authorised).toBe(false);
    expect(moved[0]!.needsReconfirmation).toBe(true);
    // The stored digest is still the one the user agreed to.
    expect(moved[0]!.scopeDigest).toBe(scope.digest);
  });

  it('reads only the CURRENT row, and reports a revocation as refused', async () => {
    const userId = (await createTestUser(db, { username: `st-rev-${Date.now()}` })).id;
    await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    });
    await recordPurposeConsent(db, {
      userId, purpose: 'sponsor_sharing', grant: false,
      scopeDigest: scope.digest, scope, source: 'settings',
    });

    const state = await getPurposeConsentState(db, userId, {
      scopeDigest: scope.digest,
      purposes: ['sponsor_sharing'],
    });
    expect(state).toHaveLength(1);
    expect(state[0]!.state).toBe('revoked');
    expect(state[0]!.authorised).toBe(false);
    expect(state[0]!.needsReconfirmation).toBe(false);

    const history = await listPurposeConsentHistory(db, userId);
    expect(history).toHaveLength(2);
    // Newest first, so the settings history table renders in reverse order.
    expect(history[0]!.state).toBe('revoked');
    expect(history[1]!.state).toBe('granted');
  });

  it('never leaks another user\'s rows', async () => {
    const a = (await createTestUser(db, { username: `st-a-${Date.now()}` })).id;
    const b = (await createTestUser(db, { username: `st-b-${Date.now()}` })).id;
    await recordPurposeConsent(db, {
      userId: a, purpose: 'sponsor_sharing', grant: true,
      scopeDigest: scope.digest, scope, source: 'settings',
    });
    const state = await getPurposeConsentState(db, b, {
      scopeDigest: scope.digest,
      purposes: ['sponsor_sharing'],
    });
    expect(state[0]!.state).toBe('absent');
    expect(await listPurposeConsentHistory(db, b)).toHaveLength(0);
  });
});
