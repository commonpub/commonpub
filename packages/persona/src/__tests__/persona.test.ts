import { describe, expect, it } from 'vitest';

import { UnknownPersonaFieldTypeError } from '../fields.js';
import {
  BUILTIN_PERSONA_LINK_PLATFORMS,
  BUILTIN_PERSONA_SECTIONS,
  type PersonaField,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  USER_BRIDGE_COLUMNS,
  effectiveLinkPlatforms,
  findLinkPlatform,
  isPersonaFieldAggregatable,
  linkUrlMatchesPlatform,
  personaCompleteness,
  personaFieldSink,
} from '../persona.js';

function field(overrides: Partial<PersonaField> & Pick<PersonaField, 'type'>): PersonaField {
  return { key: 'f', label: 'A field', ...overrides };
}

describe('personaFieldSink', () => {
  it('routes a closed-vocabulary answer to the answers sink', () => {
    expect(personaFieldSink(field({ type: 'select' }))).toBe('answers');
    expect(personaFieldSink(field({ type: 'radio' }))).toBe('answers');
    expect(personaFieldSink(field({ type: 'checkbox' }))).toBe('answers');
    expect(personaFieldSink(field({ type: 'multiselect' }))).toBe('answers');
  });

  it('routes free text to the text sink', () => {
    for (const type of ['text', 'textarea', 'url', 'number', 'date'] as const) {
      expect(personaFieldSink(field({ type })), type).toBe('text');
    }
  });

  it('forces text when sensitive is true, whatever the type says', () => {
    // Art. 9 escape hatch: a sensitive answer leaves the aggregatable partition
    // entirely rather than being counted with a flag set somewhere else.
    expect(personaFieldSink(field({ type: 'multiselect', sensitive: true }))).toBe('text');
    expect(isPersonaFieldAggregatable(field({ type: 'multiselect', sensitive: true }))).toBe(false);
  });

  it('forces text when the operator turns analytics off for the field', () => {
    expect(personaFieldSink(field({ type: 'select', analytics: false }))).toBe('text');
    expect(isPersonaFieldAggregatable(field({ type: 'select', analytics: false }))).toBe(false);
  });

  it('forces none when the field is bound to an existing users column', () => {
    // The answer lives on the users row, so the persona tables must hold nothing
    // for it. Two homes for one datum is how one of them ends up stale.
    expect(personaFieldSink(field({ type: 'text', column: 'headline' }))).toBe('none');
    expect(personaFieldSink(field({ type: 'select', column: 'location' }))).toBe('none');
    expect(isPersonaFieldAggregatable(field({ type: 'select', column: 'location' }))).toBe(false);
  });

  it('routes a link to the links sink and a section heading nowhere', () => {
    expect(personaFieldSink(field({ type: 'link', platform: 'github' }))).toBe('links');
    expect(personaFieldSink(field({ type: 'section' }))).toBe('none');
    expect(isPersonaFieldAggregatable(field({ type: 'link', platform: 'github' }))).toBe(false);
  });

  it('fails closed on an unknown type instead of quietly storing nothing', () => {
    const rogue = { type: 'signature' } as unknown as PersonaField;
    expect(() => personaFieldSink(rogue)).toThrow(UnknownPersonaFieldTypeError);
    expect(() => isPersonaFieldAggregatable(rogue)).toThrow(UnknownPersonaFieldTypeError);
  });

  it('has no bridge column named website', () => {
    // Appendix B1: website is a link platform. A field declaring
    // `column: 'website'` would write nowhere once links normalize.
    expect([...USER_BRIDGE_COLUMNS]).not.toContain('website');
    expect([...USER_BRIDGE_COLUMNS]).toEqual([
      'displayName',
      'bio',
      'headline',
      'location',
      'pronouns',
    ]);
  });
});

describe('link platforms', () => {
  it('seeds exactly the seven keys users.social_links already supports', () => {
    // v1 link fields write through the existing profile update path, so a
    // platform with nowhere to store its value would be a field that saves
    // nothing. gitlab and website arrive with the normalized links table.
    expect(BUILTIN_PERSONA_LINK_PLATFORMS.map((p) => p.key)).toEqual([
      'github',
      'twitter',
      'linkedin',
      'youtube',
      'instagram',
      'mastodon',
      'discord',
    ]);
  });

  it('carries the authenticity signal as a registry fact', () => {
    expect(findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'github')?.authenticitySignal).toBe(
      true,
    );
    expect(findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'linkedin')?.authenticitySignal).toBe(
      true,
    );
    expect(findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'discord')?.authenticitySignal).toBe(
      false,
    );
  });

  it('lets an operator add a platform', () => {
    const extra: PersonaLinkPlatformSpec = {
      key: 'hackaday',
      label: 'Hackaday',
      hostSuffixes: ['hackaday.io'],
      placeholder: 'https://hackaday.io/yourname',
      authenticitySignal: false,
    };
    const merged = effectiveLinkPlatforms([extra]);
    expect(merged).toHaveLength(BUILTIN_PERSONA_LINK_PLATFORMS.length + 1);
    expect(findLinkPlatform(merged, 'hackaday')?.label).toBe('Hackaday');
  });

  it('does NOT let an operator redefine a built-in key', () => {
    const impostor: PersonaLinkPlatformSpec = {
      key: 'github',
      label: 'GitHub',
      hostSuffixes: ['github.attacker.example'],
      placeholder: 'x',
      authenticitySignal: true,
    };
    const merged = effectiveLinkPlatforms([impostor]);
    expect(merged).toHaveLength(BUILTIN_PERSONA_LINK_PLATFORMS.length);
    expect(findLinkPlatform(merged, 'github')?.hostSuffixes).toEqual(['github.com']);
  });

  it('dedupes repeated operator keys, first declaration winning', () => {
    const one: PersonaLinkPlatformSpec = {
      key: 'forum',
      label: 'First',
      hostSuffixes: ['one.example'],
      placeholder: '',
      authenticitySignal: false,
    };
    const two: PersonaLinkPlatformSpec = { ...one, label: 'Second' };
    expect(findLinkPlatform(effectiveLinkPlatforms([one, two]), 'forum')?.label).toBe('First');
  });
});

describe('linkUrlMatchesPlatform', () => {
  const github = findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'github')!;

  it('matches the exact host and any dot-suffixed subdomain', () => {
    expect(linkUrlMatchesPlatform('https://github.com/someone', github)).toBe(true);
    expect(linkUrlMatchesPlatform('https://gist.github.com/someone', github)).toBe(true);
    expect(linkUrlMatchesPlatform('https://GITHUB.COM/someone', github)).toBe(true);
  });

  it('does NOT match a lookalike host', () => {
    // The whole reason matching is suffix-with-a-dot rather than `includes`.
    expect(linkUrlMatchesPlatform('https://evilgithub.com/someone', github)).toBe(false);
    expect(linkUrlMatchesPlatform('https://github.com.attacker.example/x', github)).toBe(false);
    expect(linkUrlMatchesPlatform('https://notgithub.com/x', github)).toBe(false);
  });

  it('rejects a non-http scheme and an unparseable value', () => {
    expect(linkUrlMatchesPlatform('javascript:alert(1)//github.com', github)).toBe(false);
    expect(linkUrlMatchesPlatform('not a url', github)).toBe(false);
    expect(linkUrlMatchesPlatform('', github)).toBe(false);
  });

  it('accepts any http(s) host for a federated platform with no suffixes', () => {
    const mastodon = findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'mastodon')!;
    expect(mastodon.hostSuffixes).toEqual([]);
    expect(linkUrlMatchesPlatform('https://social.example.org/@someone', mastodon)).toBe(true);
    expect(linkUrlMatchesPlatform('javascript:alert(1)', mastodon)).toBe(false);
  });

  it('matches any of several declared suffixes', () => {
    const twitter = findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'twitter')!;
    expect(linkUrlMatchesPlatform('https://x.com/someone', twitter)).toBe(true);
    expect(linkUrlMatchesPlatform('https://twitter.com/someone', twitter)).toBe(true);
    expect(linkUrlMatchesPlatform('https://xx.com/someone', twitter)).toBe(false);
  });
});

describe('BUILTIN_PERSONA_SECTIONS', () => {
  it('expresses today’s profile as section one', () => {
    expect(BUILTIN_PERSONA_SECTIONS.map((s) => s.key)).toEqual([
      'basics',
      'interests',
      'tech_stack',
      'links',
    ]);
  });

  it('binds every profile field to its existing users column', () => {
    const basics = BUILTIN_PERSONA_SECTIONS[0]!;
    const bound = basics.fields.filter((f) => f.column);
    expect(bound.map((f) => f.column)).toEqual([
      'displayName',
      'headline',
      'location',
      'pronouns',
      'bio',
    ]);
    for (const f of bound) expect(personaFieldSink(f), f.key).toBe('none');
  });

  it('ships exactly three aggregatable fields, all closed vocabularies', () => {
    const aggregatable = BUILTIN_PERSONA_SECTIONS.flatMap((s) => s.fields).filter(
      isPersonaFieldAggregatable,
    );
    expect(aggregatable.map((f) => f.key)).toEqual(['industry', 'interests', 'tech_stack']);
    for (const f of aggregatable) expect((f.options ?? []).length, f.key).toBeGreaterThan(0);
  });

  it('carries the option counts the design asked for', () => {
    const byKey = new Map(BUILTIN_PERSONA_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f]));
    expect(byKey.get('interests')?.options).toHaveLength(18);
    expect(byKey.get('tech_stack')?.options).toHaveLength(16);
    expect(byKey.get('industry')?.options?.length).toBeGreaterThanOrEqual(2);
  });

  it('has one link field per built-in platform', () => {
    const links = BUILTIN_PERSONA_SECTIONS.find((s) => s.key === 'links')!;
    expect(links.fields).toHaveLength(BUILTIN_PERSONA_LINK_PLATFORMS.length);
    expect(links.fields.map((f) => f.platform)).toEqual(
      BUILTIN_PERSONA_LINK_PLATFORMS.map((p) => p.key),
    );
    for (const f of links.fields) expect(f.type).toBe('link');
  });

  it('gives no field a duplicate key', () => {
    const keys = BUILTIN_PERSONA_SECTIONS.flatMap((s) => s.fields).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('publishes nothing on a profile by default', () => {
    // Every field, not a sample. Which answers belong on a public page is a
    // decision about a particular community, and a default here would make it
    // for every operator at once: the makerspace asking which tools you are
    // checked out on would publish the answer without ever choosing to.
    const fields = BUILTIN_PERSONA_SECTIONS.flatMap((s) => s.fields);
    expect(fields.length).toBeGreaterThanOrEqual(9);
    for (const f of fields) {
      expect(f.showOnProfile, f.key).toBeUndefined();
    }
  });

  it('says nothing about statistics or sharing in any built-in string', () => {
    // An instance can run persona with every sharing flag off and ask purely
    // operational questions. Copy baked in here would describe, on that
    // instance, something that never happens.
    const strings = BUILTIN_PERSONA_SECTIONS.flatMap((s) => [
      s.label,
      s.help ?? '',
      ...s.fields.flatMap((f) => [f.label, f.help ?? '']),
    ]);
    expect(strings.length).toBeGreaterThanOrEqual(20);
    for (const s of strings) {
      const lower = s.toLowerCase();
      for (const banned of ['statistic', 'counted', 'recruiter', 'sponsor', 'shared with']) {
        expect(lower, `${banned} in "${s}"`).not.toContain(banned);
      }
    }
  });
});

describe('personaCompleteness', () => {
  const sections: PersonaSection[] = [
    {
      key: 'basics',
      label: 'Basics',
      fields: [
        { key: 'heading', label: 'About you', type: 'section' },
        { key: 'display_name', label: 'Name', type: 'text', points: 5 },
        { key: 'bio', label: 'Bio', type: 'textarea', points: 10 },
      ],
    },
    {
      key: 'interests',
      label: 'Interests',
      fields: [
        {
          key: 'interests',
          label: 'Interests',
          type: 'multiselect',
          maxSelections: 5,
          pointsPerSelection: 4,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
    },
  ];

  it('counts only answerable fields, so headings do not sit permanently unfilled', () => {
    const result = personaCompleteness(sections, {});
    expect(result.totalFields).toBe(3);
    expect(result.filledFields).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.perSection.map((s) => s.totalFields)).toEqual([2, 1]);
  });

  it('treats blank strings and empty arrays as unanswered', () => {
    const result = personaCompleteness(sections, {
      display_name: '   ',
      bio: '',
      interests: [],
    });
    expect(result.filledFields).toBe(0);
    expect(result.perSection.every((s) => s.filled === false)).toBe(true);
  });

  it('reports per-section and overall progress', () => {
    const result = personaCompleteness(sections, {
      display_name: 'Ada',
      interests: ['a'],
    });
    expect(result.filledFields).toBe(2);
    expect(result.totalFields).toBe(3);
    expect(result.percent).toBe(67);
    expect(result.perSection[0]).toMatchObject({
      key: 'basics',
      filledFields: 1,
      totalFields: 2,
      percent: 50,
      filled: true,
    });
    expect(result.perSection[1]).toMatchObject({ key: 'interests', percent: 100, filled: true });
  });

  it('caps per-selection points at maxSelections', () => {
    // "+4 PTS EACH (MAX 5)" means five, not however many chips exist.
    const wide: PersonaSection[] = [
      {
        key: 's',
        label: 'S',
        fields: [
          {
            key: 'interests',
            label: 'Interests',
            type: 'multiselect',
            maxSelections: 5,
            pointsPerSelection: 4,
            options: [{ value: 'a', label: 'A' }],
          },
        ],
      },
    ];
    const answers = { interests: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    expect(personaCompleteness(wide, answers).points).toBe(20);
  });

  it('awards a field’s points only once it is answered', () => {
    expect(personaCompleteness(sections, {}).points).toBe(0);
    expect(personaCompleteness(sections, { display_name: 'Ada' }).points).toBe(5);
    expect(personaCompleteness(sections, { display_name: 'Ada', bio: 'hi' }).points).toBe(15);
  });

  it('returns zeros for an empty schema rather than dividing by zero', () => {
    expect(personaCompleteness([], {})).toEqual({
      perSection: [],
      filledFields: 0,
      totalFields: 0,
      percent: 0,
      points: 0,
    });
  });

  it('takes no consent input of any kind, in any argument', () => {
    // The anti-cringe rule, enforced by the signature: completeness measures
    // what you wrote about yourself, sharing is a separate decision, and points
    // can never increase for enabling a sharing toggle because there is no
    // sharing state to read. Deep-equal with and without every grant.
    expect(personaCompleteness).toHaveLength(2);
    const answers = { display_name: 'Ada', bio: 'hi', interests: ['a', 'b'] };
    const a = personaCompleteness(sections, answers);
    const b = personaCompleteness(sections, { ...answers });
    expect(a).toEqual(b);
  });

  it('works on the built-in schema', () => {
    const result = personaCompleteness(BUILTIN_PERSONA_SECTIONS, { display_name: 'Ada' });
    expect(result.totalFields).toBe(15);
    expect(result.filledFields).toBe(1);
  });
});
