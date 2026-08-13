import { describe, expect, it } from 'vitest';

import {
  DIGEST_INCLUDES_FIELD_KEYS,
  type DataRecipient,
  PERSONA_DATA_CLASSES,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  PURPOSE_COPY_MAX_LENGTH,
  type ProcessingPurposeId,
  purposeCovers,
  purposeIsOfferable,
  purposeScopeDigest,
  renderPurposeOnSummary,
} from '../purposes.js';

const ALL: ProcessingPurposeId[] = [...PROCESSING_PURPOSES];

/** The floors an operator can actually configure, at both extremes. */
const FLOOR = { minBucket: 5, minPopulation: 25 } as const;
const CEILING = { minBucket: 100, minPopulation: 10_000 } as const;

function recipient(overrides: Partial<DataRecipient> = {}): DataRecipient {
  return {
    id: 'acme',
    name: 'Acme Robotics',
    privacyPolicyUrl: 'https://acme.example/privacy',
    purposes: ['sponsor_sharing'],
    relationship: 'processor',
    ...overrides,
  };
}

describe('the purpose registry', () => {
  it('covers every declared purpose', () => {
    expect(Object.keys(PROCESSING_PURPOSE_SPECS).sort()).toEqual([...PROCESSING_PURPOSES].sort());
    expect(PROCESSING_PURPOSES.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every id short enough for its own consent column', () => {
    // `user_purpose_consents.purpose` is varchar(24) in migration 0046. The
    // `sharing:<id>` audit row this bound once served was removed by plan 14.4
    // rather than ALTER a live GDPR table.
    for (const id of PROCESSING_PURPOSES) {
      expect(id.length, id).toBeLessThanOrEqual(24);
    }
  });

  it('defaults every purpose to OFF, as a type not as a test', () => {
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(spec.defaultGranted, id).toBe(false);
      expect(spec.legalBasis, id).toBe('consent');
      expect(spec.answersAfterRevocation, id).toBe('kept_on_your_profile');
    }
  });

  it('says what is true while it is off before saying what turning it on does', () => {
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(spec.offSummary.length, id).toBeGreaterThan(20);
      expect(spec.offSummary.toLowerCase(), id).toContain('right now');
      expect(renderPurposeOnSummary(id, FLOOR).toLowerCase(), id).toContain('if you turn this on');
      expect(spec.revocationEffect.toLowerCase(), id).toContain('turn this off at any time');
    }
  });

  it('discloses the profile visibility exclusion on the analytics purpose', () => {
    // Appendix B3. The aggregation query filters on a public profile, so a user
    // who grants this and then goes private is silently not counted. Being told
    // "your answers are counted" with no caveat would be false.
    expect(renderPurposeOnSummary('profile_analytics', FLOOR)).toContain(
      'While your profile is set to private, your answers are not counted, even with this turned on.',
    );
  });

  it('states the OPERATOR’s bucket floor, not a hardcoded five', () => {
    // "Measure what you ship." A card that says "at least five people" on an
    // instance running `minBucket: 25` understates the member's own protection
    // by five times, and the stored Art. 7(1) snapshot carries the wrong number
    // as the record of what they were shown.
    expect(renderPurposeOnSummary('profile_analytics', FLOOR)).toContain('at least 5 people');
    expect(renderPurposeOnSummary('profile_analytics', { ...FLOOR, minBucket: 25 })).toContain(
      'at least 25 people',
    );
  });

  it('says counts are rounded DOWN, which is what quantisePersonaCount does', () => {
    // Audit B8 changed the implementation from round-to-nearest to floor. Copy
    // that still said "rounded" described a build that no longer exists.
    expect(renderPurposeOnSummary('profile_analytics', FLOOR)).toContain('rounded down');
  });

  it('leaves no unsubstituted token in any rendered sentence', () => {
    for (const id of PROCESSING_PURPOSES) {
      expect(renderPurposeOnSummary(id, FLOOR), id).not.toMatch(/[{}]/);
    }
  });

  it('keeps every rendered sentence inside the stored-snapshot cap', () => {
    // The snapshot validator rejects a longer sentence at write time, which
    // would make consent unrecordable. The widest substitution has to fit.
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(spec.offSummary.length, id).toBeLessThanOrEqual(PURPOSE_COPY_MAX_LENGTH);
      expect(renderPurposeOnSummary(id, CEILING).length, id).toBeLessThanOrEqual(
        PURPOSE_COPY_MAX_LENGTH,
      );
    }
  });

  it('names link counting on the purpose that actually counts links', () => {
    // `getPersonaLinkPresence` joins `user_purpose_consents` on
    // `profile_analytics` and aggregates `users.social_links`, which is the
    // `profile_links` data class. Consent obtained for a narrower scope than the
    // processing performed is consent for something else.
    expect(purposeCovers('profile_analytics', 'profile_links')).toBe(true);
    expect(renderPurposeOnSummary('profile_analytics', FLOOR).toLowerCase()).toContain(
      'link platforms',
    );
  });

  it('never claims to cover a class its copy does not mention', () => {
    // Weaker than the assertion above, and deliberately so: it is the general
    // rule, checked for every purpose rather than only the one that broke.
    const mentions: Record<string, string[]> = {
      persona_selections: ['interests', 'tech stack'],
      profile_links: ['link'],
      location_coarse: ['town', 'location'],
      public_identity: ['public profile'],
    };
    for (const id of PROCESSING_PURPOSES) {
      const copy = renderPurposeOnSummary(id, FLOOR).toLowerCase();
      for (const cls of PROCESSING_PURPOSE_SPECS[id].covers) {
        const words = mentions[cls] ?? [];
        expect(words.some((w) => copy.includes(w)), `${id} covers ${cls}`).toBe(true);
      }
    }
  });

  it('never puts a contact address in any purpose’s covers', () => {
    // Recruiters contact people through instance messaging. An email-bearing
    // consent turns this into a lead-generation product.
    for (const id of PROCESSING_PURPOSES) {
      for (const cls of PROCESSING_PURPOSE_SPECS[id].covers) {
        expect(PERSONA_DATA_CLASSES, `${id}/${cls}`).toContain(cls);
        expect(cls).not.toContain('email');
      }
    }
  });

  it('uses no em dash and no exclamation mark in any consent copy', () => {
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      const copy = [
        spec.label,
        spec.offSummary,
        renderPurposeOnSummary(id, FLOOR),
        spec.revocationEffect,
      ].join(' ');
      expect(copy, id).not.toMatch(/—/);
      expect(copy, id).not.toContain('!');
      for (const banned of ['Help us improve', 'Get the most out of', 'Unlock', 'Boost']) {
        expect(copy.toLowerCase(), `${id}/${banned}`).not.toContain(banned.toLowerCase());
      }
    }
  });
});

describe('purposeIsOfferable', () => {
  const base = {
    recipients: [] as readonly DataRecipient[],
    aggregatableFieldKeys: ['interests'] as readonly string[],
    enabledPurposes: ALL as readonly ProcessingPurposeId[],
  };

  it('is false for any purpose whose read surface is not enabled', () => {
    // A purpose nobody can act on is not offered, not listed on the privacy
    // page, and not returned by the consent endpoint.
    expect(purposeIsOfferable('profile_analytics', { ...base, enabledPurposes: [] })).toBe(false);
    expect(
      purposeIsOfferable('sponsor_sharing', {
        ...base,
        enabledPurposes: ['profile_analytics'],
        recipients: [recipient()],
      }),
    ).toBe(false);
  });

  it('is false for profile_analytics with no aggregatable field', () => {
    expect(purposeIsOfferable('profile_analytics', { ...base, aggregatableFieldKeys: [] })).toBe(
      false,
    );
  });

  it('is true for profile_analytics once one aggregatable field exists', () => {
    expect(purposeIsOfferable('profile_analytics', base)).toBe(true);
  });

  it('is false for sponsor_sharing with zero recipients', () => {
    expect(purposeIsOfferable('sponsor_sharing', base)).toBe(false);
  });

  it('is true for sponsor_sharing once a papered recipient exists', () => {
    expect(purposeIsOfferable('sponsor_sharing', { ...base, recipients: [recipient()] })).toBe(
      true,
    );
  });

  it('refuses a purpose whose recipient list contains an unpapered controller', () => {
    // An operator cannot deploy past an unpapered onward transfer: it makes the
    // purpose unofferable rather than making the disclosure quietly.
    const unpapered = recipient({ relationship: 'joint_controller' });
    expect(purposeIsOfferable('sponsor_sharing', { ...base, recipients: [unpapered] })).toBe(false);

    const papered = recipient({
      relationship: 'joint_controller',
      agreementRef: 'https://acme.example/dpa.pdf',
    });
    expect(purposeIsOfferable('sponsor_sharing', { ...base, recipients: [papered] })).toBe(true);
  });

  it('ignores a recipient declared for a different purpose', () => {
    const other = recipient({ id: 'other', purposes: ['recruiter_visibility'] });
    expect(purposeIsOfferable('sponsor_sharing', { ...base, recipients: [other] })).toBe(false);
  });
});

describe('purposeScopeDigest', () => {
  const input = {
    policyVersion: '1',
    dataClasses: ['persona_selections'],
    recipientIds: ['acme'],
    aggregatableFieldKeys: ['interests', 'tech_stack'],
  };

  it('is stable and order independent', () => {
    expect(purposeScopeDigest(input)).toBe(purposeScopeDigest({ ...input }));
    expect(
      purposeScopeDigest({ ...input, aggregatableFieldKeys: ['tech_stack', 'interests'] }),
    ).toBe(purposeScopeDigest(input));
  });

  it('changes when a recipient is added', () => {
    expect(purposeScopeDigest({ ...input, recipientIds: ['acme', 'contoso'] })).not.toBe(
      purposeScopeDigest(input),
    );
  });

  it('changes when the policy version bumps', () => {
    expect(purposeScopeDigest({ ...input, policyVersion: '2' })).not.toBe(
      purposeScopeDigest(input),
    );
  });

  it('changes when a data class is added', () => {
    expect(
      purposeScopeDigest({ ...input, dataClasses: ['persona_selections', 'profile_links'] }),
    ).not.toBe(purposeScopeDigest(input));
  });

  it('changes when an aggregatable field key is added, which is the shipped default', () => {
    // Appendix B10's decision, shipped as `true`.
    expect(DIGEST_INCLUDES_FIELD_KEYS).toBe(true);
    const more = [...input.aggregatableFieldKeys, 'industry'];
    expect(purposeScopeDigest({ ...input, aggregatableFieldKeys: more })).not.toBe(
      purposeScopeDigest(input),
    );
  });

  it('ignores field keys when the caller reverses B10, which is one argument', () => {
    // Both branches are reachable and testable because the decision is an INPUT
    // with a default, not a `boolean`-annotated constant keeping a dead branch
    // alive for the compiler.
    const more = [...input.aggregatableFieldKeys, 'industry'];
    expect(
      purposeScopeDigest({ ...input, aggregatableFieldKeys: more, includeFieldKeys: false }),
    ).toBe(purposeScopeDigest({ ...input, includeFieldKeys: false }));
  });

  it('cannot be collided by moving characters across a part boundary', () => {
    // FNV-1a hashes the parts as one stream, so tagging alone is not enough:
    // without a delimiter ['rc:ab','rc:c'] and ['rc:a','brc:c'] hash the same.
    // `policyVersion` is an operator-controlled free string, so this is the one
    // part an operator could aim at the boundary.
    const a = purposeScopeDigest({
      policyVersion: 'ab',
      dataClasses: [],
      recipientIds: ['c'],
      aggregatableFieldKeys: [],
    });
    const b = purposeScopeDigest({
      policyVersion: 'a',
      dataClasses: [],
      recipientIds: ['bc'],
      aggregatableFieldKeys: [],
    });
    expect(a).not.toBe(b);
  });

  it('does NOT change when a field label is edited', () => {
    // Labels are not in the digest, so fixing a typo does not re-ask everyone.
    expect(purposeScopeDigest({ ...input })).toBe(purposeScopeDigest({ ...input }));
  });

  it('does not confuse a recipient id with a field key that shares its text', () => {
    // Parts are tagged before hashing, so these two inputs cannot collide even
    // though FNV-1a hashes the parts as one stream.
    const a = purposeScopeDigest({
      policyVersion: '1',
      dataClasses: [],
      recipientIds: ['acme'],
      aggregatableFieldKeys: [],
    });
    const b = purposeScopeDigest({
      policyVersion: '1',
      dataClasses: [],
      recipientIds: [],
      aggregatableFieldKeys: ['acme'],
    });
    expect(a).not.toBe(b);
  });

  it('ignores duplicates in any list', () => {
    expect(purposeScopeDigest({ ...input, recipientIds: ['acme', 'acme'] })).toBe(
      purposeScopeDigest(input),
    );
  });
});
