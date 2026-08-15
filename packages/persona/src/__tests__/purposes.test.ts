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
import { PERSONA_STATISTICS } from '../statistics.js';

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
  });

  it('is exactly the two named third-party exposures', () => {
    // Not `length >= n`: the SET is the decision. `profile_analytics` was
    // removed because the instance holds its own totals regardless, so a
    // consent card for it was asking permission that would not be honoured in
    // the refusal. Statistics live in `statistics.ts` as an objection.
    expect([...PROCESSING_PURPOSES].sort()).toEqual(['recruiter_visibility', 'sponsor_sharing']);
  });

  it('asks about nothing except an exposure to a named third party', () => {
    // The shape all of them share, and the reason the registry still exists.
    // A purpose describing what this instance does with its own records would
    // be a consent request for processing that happens either way.
    for (const id of PROCESSING_PURPOSES) {
      expect(PROCESSING_PURPOSE_SPECS[id].disclosedTo, id).toBe('named_recipients');
      expect(PROCESSING_PURPOSE_SPECS[id].requiresRecipients, id).toBe(true);
    }
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
      expect(spec.answersAfterRevocation, id).toBe('kept_in_your_account');
    }
  });

  it('never tells a member their answers are on a profile they did not publish', () => {
    // `showOnProfile` defaults OFF, so "your answers stay on your profile" is
    // false for every field an operator has not opted in. A reassurance that
    // names a place the data is not is worse than no reassurance.
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      const copy = [spec.offSummary, renderPurposeOnSummary(id, FLOOR), spec.revocationEffect]
        .join(' ')
        .toLowerCase();
      expect(copy, id).not.toContain('stay on your profile');
      expect(copy, id).not.toContain('only visible on your profile');
    }
  });

  it('says what leaves, because that is what these purposes do', () => {
    // The old analytics copy promised "nothing about you leaves this site". It
    // was written for counting and is exactly backwards for a purpose whose
    // whole function is that something does leave, so no purpose may claim it.
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      const copy = [spec.offSummary, renderPurposeOnSummary(id, FLOOR), spec.revocationEffect]
        .join(' ')
        .toLowerCase();
      expect(copy, id).not.toContain('leaves this site');
      expect(copy, id).not.toContain('never leaves');
    }
  });

  it('states what turning it off cannot undo', () => {
    // "It cannot recall what was already shared" is the honest sentence. Both
    // purposes hand something to somebody else, and no switch reaches into
    // their records.
    for (const id of PROCESSING_PURPOSES) {
      expect(PROCESSING_PURPOSE_SPECS[id].revocationEffect.toLowerCase(), id).toContain(
        'cannot recall what was already shared',
      );
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

  it('never asks for consent to something this instance does anyway', () => {
    // The correction, as an assertion. Counting is not offered here in any
    // spelling: an id, a label or a sentence that framed group totals as a
    // choice would be back to asking permission whose refusal changes nothing.
    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(id, id).not.toContain('analytics');
      const copy = [spec.label, spec.offSummary, renderPurposeOnSummary(id, FLOOR)]
        .join(' ')
        .toLowerCase();
      for (const banned of ['group totals', 'community statistics', 'counted in']) {
        expect(copy, `${id}/${banned}`).not.toContain(banned);
      }
    }
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

  it('names the links it sends on every purpose that sends them', () => {
    // Consent obtained for a narrower scope than the processing performed is
    // consent for something else. Both purposes hand a recipient the links on a
    // profile, so both carry `profile_links` and both say so.
    for (const id of PROCESSING_PURPOSES) {
      expect(purposeCovers(id, 'profile_links'), id).toBe(true);
      expect(renderPurposeOnSummary(id, FLOOR).toLowerCase(), id).toContain('link');
    }
  });

  it('leaves every data class covered by something, so none is now dead', () => {
    // `profile_analytics` left with two classes in its `covers`. Both are still
    // reachable: the purposes below carry them, and `statistics.ts` declares the
    // pair its own totals are built from. A class nothing covers is a word in a
    // union that no sentence ever explains.
    const covered = new Set<string>();
    for (const id of PROCESSING_PURPOSES) {
      for (const cls of PROCESSING_PURPOSE_SPECS[id].covers) covered.add(cls);
    }
    for (const cls of PERSONA_STATISTICS.covers) covered.add(cls);
    expect([...covered].sort()).toEqual([...PERSONA_DATA_CLASSES].sort());
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
    enabledPurposes: ALL as readonly ProcessingPurposeId[],
  };

  it('is false for any purpose whose read surface is not enabled', () => {
    // A purpose nobody can act on is not offered, not listed on the privacy
    // page, and not returned by the consent endpoint.
    expect(
      purposeIsOfferable('recruiter_visibility', {
        ...base,
        enabledPurposes: [],
        recipients: [recipient({ purposes: ['recruiter_visibility'] })],
      }),
    ).toBe(false);
    expect(
      purposeIsOfferable('sponsor_sharing', {
        ...base,
        enabledPurposes: ['recruiter_visibility'],
        recipients: [recipient()],
      }),
    ).toBe(false);
  });

  it('needs a recipient for every purpose, because every purpose sends something', () => {
    // There is no aggregatable-field gate any more. It existed for
    // `profile_analytics` alone, and statistics are no longer a consent
    // question, so "nothing countable yet" can never be why a consent card is
    // withheld. What is left is the gate that matches what these purposes do.
    for (const id of ALL) {
      expect(purposeIsOfferable(id, base), id).toBe(false);
      expect(
        purposeIsOfferable(id, { ...base, recipients: [recipient({ purposes: [id] })] }),
        id,
      ).toBe(true);
    }
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
