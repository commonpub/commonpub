import { describe, expect, it } from 'vitest';

import { BUILTIN_PERSONA_SECTIONS, type PersonaSection } from '../persona.js';
import {
  PERSONA_MAX_AGGREGATABLE_BUCKETS,
  PERSONA_MAX_FIELDS_PER_SECTION,
  PERSONA_MAX_FIELDS_TOTAL,
  PERSONA_MAX_SECTIONS,
  dataRecipientSchema,
  dataSharingConfigSchema,
  definePersonaSections,
  personaConfigSchema,
  personaFieldSchema,
  personaLinkPlatformSchema,
  personaSectionsSchema,
} from '../schemas.js';
import { METRICS_MIN_BUCKET, MIN_AUDIENCE_POPULATION } from '../thresholds.js';

const okField = { key: 'industry', label: 'Industry', type: 'select' as const, options: [{ value: 'hardware', label: 'Hardware' }] };

function section(fields: unknown[], key = 's'): unknown {
  return { key, label: 'A section', fields };
}

describe('personaFieldSchema', () => {
  it('accepts a well formed field', () => {
    expect(personaFieldSchema.safeParse(okField).success).toBe(true);
  });

  it('rejects { required: true }, because a persona is never mandatory', () => {
    // The `.strict()` guarantee. A `required` toggle on a persona field would be
    // the dark pattern this whole surface exists to avoid.
    expect(personaFieldSchema.safeParse({ ...okField, required: true }).success).toBe(false);
  });

  it('rejects { pii: true }, because the sink decides, not a per-field toggle', () => {
    expect(personaFieldSchema.safeParse({ ...okField, pii: true }).success).toBe(false);
  });

  it('rejects a contest-only field type', () => {
    expect(personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'signature' }).success).toBe(
      false,
    );
    expect(personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'file' }).success).toBe(false);
  });

  it('rejects a choice field with no options', () => {
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'multiselect' }).success,
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'multiselect', options: [] })
        .success,
    ).toBe(false);
    expect(personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'select' }).success).toBe(
      false,
    );
  });

  it('rejects options on a type that has none', () => {
    expect(
      personaFieldSchema.safeParse({
        key: 'x',
        label: 'X',
        type: 'text',
        options: [{ value: 'a', label: 'A' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a blank or malformed option value', () => {
    for (const value of ['', ' ', 'Has Space', 'UPPER', 'punct!']) {
      expect(
        personaFieldSchema.safeParse({
          key: 'x',
          label: 'X',
          type: 'select',
          options: [{ value, label: 'A' }],
        }).success,
        value,
      ).toBe(false);
    }
  });

  it('rejects a link field with no platform, and a platform on anything else', () => {
    expect(personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'link' }).success).toBe(false);
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'link', platform: 'github' })
        .success,
    ).toBe(true);
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'text', platform: 'github' })
        .success,
    ).toBe(false);
  });

  it('rejects maxLength on a type whose registry spec does not support one', () => {
    // Appendix B14: the registry decides, and the validator enforces what the
    // builder can express, so the two cannot drift the way the contest surface's
    // did.
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'number', maxLength: 10 }).success,
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'date', maxLength: 10 }).success,
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({ key: 'x', label: 'X', type: 'text', maxLength: 10 }).success,
    ).toBe(true);
  });

  it('restricts maxSelections and pointsPerSelection to the chip grid', () => {
    expect(
      personaFieldSchema.safeParse({ ...okField, maxSelections: 5 }).success,
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({ ...okField, pointsPerSelection: 4 }).success,
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({
        key: 'i',
        label: 'I',
        type: 'multiselect',
        options: [{ value: 'a', label: 'A' }],
        maxSelections: 5,
        pointsPerSelection: 4,
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed key', () => {
    for (const key of ['', 'Has Space', 'UPPER', 'dash-ed', 'a'.repeat(41)]) {
      expect(personaFieldSchema.safeParse({ ...okField, key }).success, key).toBe(false);
    }
  });

  it('rejects a bridge column that does not exist', () => {
    expect(
      personaFieldSchema.safeParse({ key: 'w', label: 'W', type: 'url', column: 'website' }).success,
      'website is a link platform, not a bridge column (Appendix B1)',
    ).toBe(false);
    expect(
      personaFieldSchema.safeParse({ key: 'h', label: 'H', type: 'text', column: 'headline' })
        .success,
    ).toBe(true);
  });
});

describe('personaSectionsSchema', () => {
  it('accepts the built-in schema', () => {
    const result = personaSectionsSchema.safeParse(BUILTIN_PERSONA_SECTIONS);
    expect(result.success, JSON.stringify(result.error?.issues ?? [], null, 2)).toBe(true);
  });

  it('rejects duplicate section keys', () => {
    expect(
      personaSectionsSchema.safeParse([section([okField], 'a'), section([], 'a')]).success,
    ).toBe(false);
  });

  it('rejects duplicate field keys ACROSS sections', () => {
    // `user_persona_answers.field_key` is a global namespace: two fields sharing
    // a key would share a user's answers and an analytics bucket.
    const dup = personaSectionsSchema.safeParse([
      section([okField], 'a'),
      section([{ ...okField }], 'b'),
    ]);
    expect(dup.success).toBe(false);
    expect(JSON.stringify(dup.error?.issues)).toContain('unique across every section');
  });

  it('rejects duplicate option values within one field', () => {
    expect(
      personaSectionsSchema.safeParse([
        section([
          {
            key: 'x',
            label: 'X',
            type: 'select',
            options: [
              { value: 'a', label: 'A' },
              { value: 'a', label: 'Also A' },
            ],
          },
        ]),
      ]).success,
    ).toBe(false);
  });

  it('rejects more than 12 sections', () => {
    const many = Array.from({ length: 13 }, (_, i) => section([], `s${i}`));
    expect(personaSectionsSchema.safeParse(many).success).toBe(false);
  });

  it('rejects more than 24 fields in one section', () => {
    const fields = Array.from({ length: 25 }, (_, i) => ({
      key: `f${i}`,
      label: 'F',
      type: 'text' as const,
    }));
    expect(personaSectionsSchema.safeParse([section(fields)]).success).toBe(false);
  });

  it('caps total fields as defence in depth behind the per-section caps', () => {
    // Honest about what this cap is: 12 sections of 24 fields is 288, so the
    // 300 total can only ever be reached if one of the other two caps is raised.
    // It is a belt, and it is tested as one rather than pretended to be
    // reachable today.
    expect(PERSONA_MAX_SECTIONS * PERSONA_MAX_FIELDS_PER_SECTION).toBeLessThanOrEqual(
      PERSONA_MAX_FIELDS_TOTAL,
    );
    const full = Array.from({ length: PERSONA_MAX_SECTIONS }, (_, s) =>
      section(
        Array.from({ length: PERSONA_MAX_FIELDS_PER_SECTION }, (_, f) => ({
          key: `f${s}_${f}`,
          label: 'F',
          type: 'text',
        })),
        `s${s}`,
      ),
    );
    expect(personaSectionsSchema.safeParse(full).success).toBe(true);
  });

  it('rejects more than the aggregatable bucket cap', () => {
    const options = Array.from({ length: 64 }, (_, i) => ({ value: `o${i}`, label: 'O' }));
    const overCap = [
      section(
        [
          { key: 'a', label: 'A', type: 'multiselect', options },
          { key: 'b', label: 'B', type: 'multiselect', options },
        ],
        'one',
      ),
    ];
    // 128 buckets, over the cap of 120.
    expect(PERSONA_MAX_AGGREGATABLE_BUCKETS).toBe(120);
    const result = personaSectionsSchema.safeParse(overCap);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('Too many countable answers');
  });

  it('does not count a field the operator kept out of analytics toward the cap', () => {
    const options = Array.from({ length: 64 }, (_, i) => ({ value: `o${i}`, label: 'O' }));
    // `select`, not `multiselect`: opting a SET-cardinality field out of
    // analytics moves it to the free-text sink, which holds one value, so the
    // combination is refused at declaration time (see the sink tests below).
    const withOptOut = [
      section(
        [
          { key: 'a', label: 'A', type: 'select', options },
          { key: 'b', label: 'B', type: 'select', options, analytics: false },
        ],
        'one',
      ),
    ];
    expect(personaSectionsSchema.safeParse(withOptOut).success).toBe(true);
  });

  it('refuses two fields bound to the same profile column', () => {
    // One column holds one answer. Saving the section containing the second
    // field with that field empty clears the value the first still displays,
    // and `personaAnswerMap` reports both as answered from one datum.
    const duplicated = [
      section(
        [
          { key: 'a', label: 'A', type: 'text', column: 'bio' },
          { key: 'b', label: 'B', type: 'textarea', column: 'bio' },
        ],
        'one',
      ),
    ];
    const result = personaSectionsSchema.safeParse(duplicated);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('bind to the profile column');
  });
});

describe('a set-cardinality field cannot be routed out of the answers sink', () => {
  /**
   * `personaFieldSink` moves a field to the `text` sink when `sensitive` is
   * true or `analytics` is false, and to `none` when a `column` is bound. All
   * three destinations store ONE value per field, so a `multiselect` routed
   * there is unfillable: the member ticks three chips, the write path calls
   * `asScalar`, and the save is refused with "takes a single value", an error
   * naming a constraint no UI expressed. Refusing the DECLARATION is the only
   * place an operator can act on it.
   */
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('rejects a sensitive multiselect, the Art. 9 shape an operator would reach for', () => {
    const result = personaFieldSchema.safeParse({
      key: 'health',
      label: 'Health interests',
      type: 'multiselect',
      options,
      sensitive: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('cannot be marked sensitive');
  });

  it('rejects a multiselect with analytics off', () => {
    const result = personaFieldSchema.safeParse({
      key: 'stack',
      label: 'Stack',
      type: 'multiselect',
      options,
      analytics: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a multiselect bound to a profile column', () => {
    const result = personaFieldSchema.safeParse({
      key: 'stack',
      label: 'Stack',
      type: 'multiselect',
      options,
      column: 'bio',
    });
    expect(result.success).toBe(false);
  });

  it('still allows all three on a scalar choice field, which stores one value', () => {
    for (const extra of [{ sensitive: true }, { analytics: false }]) {
      const result = personaFieldSchema.safeParse({
        key: 'industry',
        label: 'Industry',
        type: 'select',
        options,
        ...extra,
      });
      expect(result.success, JSON.stringify(extra)).toBe(true);
    }
  });
});

describe('definePersonaSections', () => {
  it('parses and returns, so a mistake is a boot-time error', () => {
    const sections: PersonaSection[] = [
      { key: 'extra', label: 'Extra', fields: [{ key: 'shirt', label: 'Shirt', type: 'text' }] },
    ];
    expect(definePersonaSections(sections)).toEqual(sections);
    expect(() =>
      definePersonaSections([
        { key: 'bad', label: 'Bad', fields: [{ key: 'x', label: 'X', type: 'select' }] },
      ]),
    ).toThrow();
  });
});

describe('personaLinkPlatformSchema', () => {
  const platform = {
    key: 'hackaday',
    label: 'Hackaday',
    hostSuffixes: ['hackaday.io'],
    placeholder: 'https://hackaday.io/yourname',
    authenticitySignal: false,
  };

  it('accepts a well formed platform, including one with no host restriction', () => {
    expect(personaLinkPlatformSchema.safeParse(platform).success).toBe(true);
    expect(personaLinkPlatformSchema.safeParse({ ...platform, hostSuffixes: [] }).success).toBe(
      true,
    );
  });

  it('rejects an uppercase or malformed host suffix', () => {
    expect(
      personaLinkPlatformSchema.safeParse({ ...platform, hostSuffixes: ['GitHub.com'] }).success,
    ).toBe(false);
    expect(
      personaLinkPlatformSchema.safeParse({ ...platform, hostSuffixes: ['*.github.com'] }).success,
      'no wildcards and no patterns: matching is exact host or dot suffix',
    ).toBe(false);
  });

  it('bounds the suffix list', () => {
    expect(
      personaLinkPlatformSchema.safeParse({
        ...platform,
        hostSuffixes: Array.from({ length: 9 }, (_, i) => `h${i}.example`),
      }).success,
    ).toBe(false);
  });
});

describe('dataRecipientSchema', () => {
  const base = {
    id: 'acme',
    name: 'Acme Robotics',
    privacyPolicyUrl: 'https://acme.example/privacy',
    purposes: ['sponsor_sharing'],
    relationship: 'processor',
  };

  it('accepts a processor with no agreement reference', () => {
    expect(dataRecipientSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a joint controller with no agreementRef', () => {
    expect(
      dataRecipientSchema.safeParse({ ...base, relationship: 'joint_controller' }).success,
    ).toBe(false);
    expect(
      dataRecipientSchema.safeParse({
        ...base,
        relationship: 'independent_controller',
        agreementRef: 'https://acme.example/dpa.pdf',
      }).success,
    ).toBe(true);
  });

  it('requires a privacy policy URL, and requires it to be http(s)', () => {
    const withoutPolicy: Record<string, unknown> = { ...base };
    delete withoutPolicy.privacyPolicyUrl;
    expect(dataRecipientSchema.safeParse(withoutPolicy).success).toBe(false);
    expect(
      dataRecipientSchema.safeParse({ ...base, privacyPolicyUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('requires at least one purpose', () => {
    expect(dataRecipientSchema.safeParse({ ...base, purposes: [] }).success).toBe(false);
  });
});

describe('dataSharingConfigSchema', () => {
  it('applies the k-anonymity floors from the constants, never a literal', () => {
    // Appendix B5. An operator staring at thin numbers cannot dial these below
    // the floor, and the floor is the exported constant, so raising it raises
    // both the validator and every consumer at once.
    expect(dataSharingConfigSchema.safeParse({ minBucket: METRICS_MIN_BUCKET - 2 }).success).toBe(
      false,
    );
    expect(
      dataSharingConfigSchema.safeParse({ minPopulation: MIN_AUDIENCE_POPULATION - 15 }).success,
    ).toBe(false);
    expect(dataSharingConfigSchema.safeParse({ minBucket: 3 }).success).toBe(false);
    expect(dataSharingConfigSchema.safeParse({ minPopulation: 10 }).success).toBe(false);
  });

  it('defaults to the floors and allows raising them', () => {
    const parsed = dataSharingConfigSchema.parse({});
    expect(parsed.minBucket).toBe(METRICS_MIN_BUCKET);
    expect(parsed.minPopulation).toBe(MIN_AUDIENCE_POPULATION);
    expect(parsed.policyVersion).toBe('1');
    expect(parsed.recipients).toEqual([]);
    expect(dataSharingConfigSchema.parse({ minBucket: 25 }).minBucket).toBe(25);
  });

  it('rejects an unknown key', () => {
    expect(dataSharingConfigSchema.safeParse({ minBuckets: 5 }).success).toBe(false);
  });

  it('bounds the disclosure retention window and defaults it to two years', () => {
    // The number the purge job enforces. An unbounded one is an indefinite log
    // of who looked at whom; a sub-year one expires the accountability record
    // before a DSAR round trip can use it.
    expect(dataSharingConfigSchema.parse({}).disclosureRetentionYears).toBe(2);
    expect(dataSharingConfigSchema.parse({ disclosureRetentionYears: 7 }).disclosureRetentionYears).toBe(7);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: 1 }).success).toBe(true);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: 10 }).success).toBe(true);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: 0 }).success).toBe(false);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: 11 }).success).toBe(false);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: 2.5 }).success).toBe(false);
    expect(dataSharingConfigSchema.safeParse({ disclosureRetentionYears: '2' }).success).toBe(false);
  });
});

describe('personaConfigSchema', () => {
  it('defaults to the respectful rendering', () => {
    const parsed = personaConfigSchema.parse({});
    expect(parsed.completeness).toBe('progress');
    expect(parsed.firstRun).toBe('offer');
    expect(parsed.sections).toEqual([]);
    expect(parsed.linkPlatforms).toEqual([]);
  });

  it('validates the sections it is given', () => {
    expect(
      personaConfigSchema.safeParse({
        sections: [{ key: 'a', label: 'A', fields: [{ key: 'x', label: 'X', type: 'select' }] }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key', () => {
    expect(personaConfigSchema.safeParse({ gamification: true }).success).toBe(false);
  });
});
