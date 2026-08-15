import {
  type PersonaFieldSink,
  type PersonaFieldType,
  personaFieldSpec,
} from './fields.js';

/**
 * An existing `users` column a persona field can bind to, so today's profile is
 * section one of the persona schema rather than a parallel system.
 *
 * Appendix B1: `website` is NOT here. It is a link platform, and the same datum
 * addressable two ways is how one of them ends up writing nowhere.
 */
export const USER_BRIDGE_COLUMNS = [
  'displayName',
  'bio',
  'headline',
  'location',
  'pronouns',
] as const;

export type UserBridgeColumn = (typeof USER_BRIDGE_COLUMNS)[number];

export interface PersonaField {
  /**
   * `^[a-z0-9_]+$`, max 40. THE analytics namespace. Unique across the whole
   * template, not per section, because `user_persona_answers.field_key` is
   * global. Immutable once answers exist.
   */
  key: string;
  /** Max 120. */
  label: string;
  type: PersonaFieldType;
  /** Max 300. */
  help?: string;
  /**
   * Max 2000. Accepted only by types whose registry spec sets
   * `supportsMaxLength: true`, which today means text, textarea and url.
   * (Appendix B14: this comment tracks the registry, and the registry says
   * number and date do not take a length.)
   */
  maxLength?: number;
  /** Max 64 options; each value `^[a-z0-9_]{1,64}$`. */
  options?: Array<{ value: string; label: string }>;
  /** `multiselect` only, 1..64. */
  maxSelections?: number;
  /** Type `link` only. Validated against the effective platform set. */
  platform?: string;
  /** Optional completeness weight for the whole field. NEVER unlocks anything. */
  points?: number;
  /** Per-selection weight for a multiselect, capped by `maxSelections`. */
  pointsPerSelection?: number;
  /**
   * Operator scoping. User consent is the actual gate; this only lets an
   * operator keep a closed-vocabulary field out of statistics entirely.
   */
  analytics?: boolean;
  /**
   * Art. 9 escape hatch. Forces the field out of the aggregatable partition and
   * into the never-counted text sink.
   */
  sensitive?: boolean;
  /** Default true. */
  publicOnProfile?: boolean;
  /** Binds this field to an existing `users` column. */
  column?: UserBridgeColumn;
}

export interface PersonaSection {
  /** `^[a-z0-9_]+$`, max 40. */
  key: string;
  /** Max 120. */
  label: string;
  /** Max 300. */
  help?: string;
  collapsedByDefault?: boolean;
  order?: number;
  /** Max 24. */
  fields: PersonaField[];
}

/**
 * SINGLE SOURCE OF TRUTH for where a persona answer is stored, imported by the
 * write path, the reader, the public serializer, the DSAR export builder, the
 * analytics field list and the admin editor. Nobody re-derives it.
 *
 * Throws `UnknownPersonaFieldTypeError` for a type outside the registry, which
 * is the fail-closed answer: a caller deciding storage cannot be allowed to
 * treat an unknown type as "nothing to store".
 */
export function personaFieldSink(
  f: Pick<PersonaField, 'type' | 'analytics' | 'sensitive' | 'column'>,
): PersonaFieldSink {
  // A column-bound field lives on the users row; the persona tables hold nothing.
  if (f.column) return 'none';
  const spec = personaFieldSpec(f.type);
  if (spec.sink === 'none') return 'none';
  // Art. 9: never aggregatable, whatever the type says.
  if (f.sensitive === true) return 'text';
  if (spec.sink === 'answers' && f.analytics === false) return 'text';
  return spec.sink;
}

/**
 * The one predicate that decides whether a field can ever become an aggregate
 * bucket. Both halves matter: the sink must be `answers` AND the type must be
 * structurally countable.
 */
export function isPersonaFieldAggregatable(
  f: Pick<PersonaField, 'type' | 'analytics' | 'sensitive' | 'column'>,
): boolean {
  return personaFieldSink(f) === 'answers' && personaFieldSpec(f.type).aggregatable;
}

// --- Link platforms -------------------------------------------------------------

export interface PersonaLinkPlatformSpec {
  /** `^[a-z0-9_]{1,32}$`. */
  readonly key: string;
  /** Max 64. */
  readonly label: string;
  /**
   * Bounded list of lowercase host suffixes, max 8, each max 64. NO RegExp: a
   * pattern is neither serialisable into a config file that must round-trip
   * through JSON nor safe to accept from an operator (ReDoS). Matching is
   * `hostname === s || hostname.endsWith('.' + s)`, which is linear time.
   *
   * An EMPTY list means "any http(s) host", which is what a federated platform
   * such as Mastodon actually needs: the account can live on any instance.
   */
  readonly hostSuffixes: readonly string[];
  /** Max 120. */
  readonly placeholder: string;
  /**
   * Whether a link to this platform is treated as an authenticity signal. This
   * is a REGISTRY FACT, not a hardcoded platform list inside an analytics
   * query: an operator who adds a platform decides its signal status once,
   * where they name it.
   */
  readonly authenticitySignal: boolean;
}

/**
 * The built-in platforms, which are exactly the seven keys `users.social_links`
 * already supports (`packages/schema/src/auth.ts`). v1 link fields bind to those
 * existing keys and write through the existing profile update path, so adding a
 * platform here without a place to store it would produce a field that saves
 * nowhere. `gitlab` and `website` arrive with the normalized links table.
 */
export const BUILTIN_PERSONA_LINK_PLATFORMS: readonly PersonaLinkPlatformSpec[] = [
  {
    key: 'github',
    label: 'GitHub',
    hostSuffixes: ['github.com'],
    placeholder: 'https://github.com/yourname',
    authenticitySignal: true,
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    hostSuffixes: ['twitter.com', 'x.com'],
    placeholder: 'https://x.com/yourname',
    authenticitySignal: false,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    hostSuffixes: ['linkedin.com'],
    placeholder: 'https://www.linkedin.com/in/yourname',
    authenticitySignal: true,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    hostSuffixes: ['youtube.com', 'youtu.be'],
    placeholder: 'https://www.youtube.com/@yourchannel',
    authenticitySignal: false,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    hostSuffixes: ['instagram.com'],
    placeholder: 'https://www.instagram.com/yourname',
    authenticitySignal: false,
  },
  {
    // Federated: the account can live on any instance, so no host restriction.
    key: 'mastodon',
    label: 'Mastodon',
    hostSuffixes: [],
    placeholder: 'https://mastodon.social/@yourname',
    authenticitySignal: false,
  },
  {
    key: 'discord',
    label: 'Discord',
    hostSuffixes: ['discord.com', 'discord.gg'],
    placeholder: 'https://discord.gg/yourinvite',
    authenticitySignal: false,
  },
];

/**
 * Union of built-ins and operator-declared platforms, deduped by key with the
 * BUILT-IN winning, so an operator cannot silently redefine `github` to point at
 * a host they control.
 */
export function effectiveLinkPlatforms(
  configured: readonly PersonaLinkPlatformSpec[],
): readonly PersonaLinkPlatformSpec[] {
  const builtinKeys = new Set(BUILTIN_PERSONA_LINK_PLATFORMS.map((p) => p.key));
  const seen = new Set(builtinKeys);
  const extra: PersonaLinkPlatformSpec[] = [];
  for (const p of configured) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    extra.push(p);
  }
  return [...BUILTIN_PERSONA_LINK_PLATFORMS, ...extra];
}

/** Look up a platform by key in an effective set. Returns undefined when absent. */
export function findLinkPlatform(
  platforms: readonly PersonaLinkPlatformSpec[],
  key: string,
): PersonaLinkPlatformSpec | undefined {
  return platforms.find((p) => p.key === key);
}

/**
 * Does `url` belong to `platform`?
 *
 * Exact host or dot-suffix only, so `evilgithub.com` does not match
 * `github.com`. A malformed URL is false, and a non-http(s) scheme is false:
 * this is a host check, not a scheme check, but a `javascript:` URL has no
 * meaningful host and must never pass a platform gate.
 */
export function linkUrlMatchesPlatform(
  url: string,
  platform: Pick<PersonaLinkPlatformSpec, 'hostSuffixes'>,
): boolean {
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (platform.hostSuffixes.length === 0) return true;
  return platform.hostSuffixes.some(
    (s) => hostname === s || hostname.endsWith(`.${s}`),
  );
}

// --- Completeness ---------------------------------------------------------------

/**
 * A user's persona answers, keyed by field key. A string for a scalar field, an
 * array of option values for a multiselect. `null`, `undefined` and the empty
 * string all mean "not answered".
 */
export type PersonaAnswerMap = Readonly<
  Record<string, string | readonly string[] | null | undefined>
>;

export interface PersonaSectionCompleteness {
  key: string;
  label: string;
  filledFields: number;
  totalFields: number;
  /** 0..100, integer. 0 when the section holds no answerable field. */
  percent: number;
  /** True when at least one answerable field in this section has an answer. */
  filled: boolean;
  points: number;
}

export interface PersonaCompleteness {
  perSection: PersonaSectionCompleteness[];
  filledFields: number;
  totalFields: number;
  /** 0..100, integer. */
  percent: number;
  points: number;
}

function isAnswered(value: string | readonly string[] | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return value.length > 0;
}

function fieldPoints(field: PersonaField, value: string | readonly string[] | null | undefined): number {
  if (!isAnswered(value)) return 0;
  let total = field.points ?? 0;
  if (field.type === 'multiselect' && field.pointsPerSelection && Array.isArray(value)) {
    const capped = field.maxSelections
      ? Math.min(value.length, field.maxSelections)
      : value.length;
    total += capped * field.pointsPerSelection;
  }
  return total;
}

/**
 * How much of the persona a user has filled in.
 *
 * It takes NO consent input of any kind, in any argument, and it never will.
 * Completeness measures what the user chose to write about themselves; sharing
 * is a separate decision, and a progress number that moves when you flip a
 * sharing toggle turns consent into a score. Two consequences fall out of the
 * signature alone: points cannot increase for enabling a sharing toggle, and
 * the output is deep-equal with and without every grant.
 *
 * Layout-only fields (`section`) are excluded from every count: they are not
 * answerable, and including them would make a section of headings look
 * permanently incomplete.
 */
export function personaCompleteness(
  sections: readonly PersonaSection[],
  answers: PersonaAnswerMap,
): PersonaCompleteness {
  const perSection: PersonaSectionCompleteness[] = [];
  let filledFields = 0;
  let totalFields = 0;
  let points = 0;

  for (const section of sections) {
    let sectionFilled = 0;
    let sectionTotal = 0;
    let sectionPoints = 0;

    for (const field of section.fields) {
      if (personaFieldSpec(field.type).cardinality === 'none') continue;
      sectionTotal += 1;
      const value = answers[field.key];
      if (isAnswered(value)) {
        sectionFilled += 1;
        sectionPoints += fieldPoints(field, value);
      }
    }

    perSection.push({
      key: section.key,
      label: section.label,
      filledFields: sectionFilled,
      totalFields: sectionTotal,
      percent: sectionTotal === 0 ? 0 : Math.round((sectionFilled / sectionTotal) * 100),
      filled: sectionFilled > 0,
      points: sectionPoints,
    });

    filledFields += sectionFilled;
    totalFields += sectionTotal;
    points += sectionPoints;
  }

  return {
    perSection,
    filledFields,
    totalFields,
    percent: totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100),
    points,
  };
}

// --- Built-in sections ----------------------------------------------------------

function option(value: string, label: string): { value: string; label: string } {
  return { value, label };
}

/** The 18 interest options. */
const INTEREST_OPTIONS: Array<{ value: string; label: string }> = [
  option('hardware', 'Hardware'),
  option('software', 'Software'),
  option('iot', 'IoT'),
  option('embedded', 'Embedded'),
  option('open_source', 'Open source'),
  option('ai_ml', 'AI and machine learning'),
  option('developer_tools', 'Developer tools'),
  option('cloud', 'Cloud'),
  option('security', 'Security'),
  option('maker', 'Making'),
  option('electronics', 'Electronics'),
  option('pcb', 'PCB design'),
  option('robotics', 'Robotics'),
  option('printing_3d', '3D printing'),
  option('game_dev', 'Game development'),
  option('web_dev', 'Web development'),
  option('mobile', 'Mobile'),
  option('devops', 'DevOps'),
];

/** The 16 tech-stack options. */
const TECH_STACK_OPTIONS: Array<{ value: string; label: string }> = [
  option('rust', 'Rust'),
  option('python', 'Python'),
  option('typescript', 'TypeScript'),
  option('javascript', 'JavaScript'),
  option('go', 'Go'),
  option('c_cpp', 'C and C++'),
  option('vue', 'Vue'),
  option('react', 'React'),
  option('node', 'Node.js'),
  option('arduino', 'Arduino'),
  option('raspberry_pi', 'Raspberry Pi'),
  option('esp32', 'ESP32'),
  option('docker', 'Docker'),
  option('kubernetes', 'Kubernetes'),
  option('terraform', 'Terraform'),
  option('postgres', 'PostgreSQL'),
];

/** A closed vocabulary, so `industry` can be a counted cohort. */
const INDUSTRY_OPTIONS: Array<{ value: string; label: string }> = [
  option('hardware', 'Hardware'),
  option('software', 'Software'),
  option('consumer_electronics', 'Consumer electronics'),
  option('industrial', 'Industrial and manufacturing'),
  option('automotive', 'Automotive'),
  option('aerospace', 'Aerospace'),
  option('robotics', 'Robotics and automation'),
  option('medical', 'Medical and health'),
  option('education', 'Education'),
  option('research', 'Research'),
  option('agriculture', 'Agriculture'),
  option('energy', 'Energy'),
  option('gaming', 'Games'),
  option('media', 'Media and creative'),
  option('retail', 'Retail and commerce'),
  option('nonprofit', 'Nonprofit'),
  option('student', 'Student'),
  option('other', 'Something else'),
];

function linkField(platform: PersonaLinkPlatformSpec): PersonaField {
  return {
    key: `link_${platform.key}`,
    label: platform.label,
    type: 'link',
    platform: platform.key,
    help: platform.placeholder,
  };
}

/**
 * Today's profile expressed as a persona schema, so the profile is section one
 * of this system rather than a parallel one. An operator can relabel, reorder or
 * hide any of these without a schema change. Only the unbound fields
 * (`industry`, `interests`, `tech_stack`) touch the new persona tables; every
 * `column:`-bound field writes to the existing `users` row, and every `link`
 * field writes to the existing `users.social_links` keys.
 */
export const BUILTIN_PERSONA_SECTIONS: readonly PersonaSection[] = [
  {
    key: 'basics',
    label: 'Basics',
    order: 0,
    fields: [
      {
        key: 'display_name',
        label: 'Display name',
        type: 'text',
        maxLength: 128,
        column: 'displayName',
      },
      {
        key: 'headline',
        label: 'Job title',
        type: 'text',
        maxLength: 255,
        column: 'headline',
      },
      {
        key: 'location',
        label: 'Location',
        type: 'text',
        maxLength: 128,
        column: 'location',
      },
      {
        key: 'pronouns',
        label: 'Pronouns',
        type: 'text',
        maxLength: 32,
        column: 'pronouns',
      },
      {
        key: 'bio',
        label: 'About you',
        type: 'textarea',
        maxLength: 2000,
        column: 'bio',
      },
      {
        key: 'industry',
        label: 'Industry',
        type: 'select',
        help: 'Pick the closest one. This is one of the answers that can be counted in community statistics.',
        options: INDUSTRY_OPTIONS,
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
        options: INTEREST_OPTIONS,
      },
    ],
  },
  {
    key: 'tech_stack',
    label: 'Tech stack',
    order: 2,
    fields: [
      {
        key: 'tech_stack',
        label: 'What do you build with?',
        type: 'multiselect',
        options: TECH_STACK_OPTIONS,
      },
    ],
  },
  {
    key: 'links',
    label: 'Links',
    order: 3,
    fields: BUILTIN_PERSONA_LINK_PLATFORMS.map(linkField),
  },
];

/**
 * The invitation cookie name and its terminal dismissal count.
 *
 * These live here because THREE surfaces speak them and none can import the
 * others: `PersonaInvitationBanner.vue` writes the cookie, `GET
 * /api/persona/status` reads it (a Nitro route cannot be imported by a
 * component), and the privacy disclosure names it. A hand-copied cookie name
 * that drifts does not fail loudly: the dismissal silently stops being
 * remembered and the banner comes back forever.
 *
 * Plan 8.4 classifies this as an essential cookie (no analytics, no identifier,
 * one small integer recording that the viewer said no).
 */
export const PERSONA_INVITE_DISMISSED_COOKIE = 'cpub-persona-invite-dismissed';

/**
 * After this many refusals the invitation never returns. Plan 8.4 wants that
 * terminal state to follow the user across devices, which needs a server-side
 * record; v1 stores the count in the cookie only, so the promise holds per
 * browser. See the session log.
 */
export const PERSONA_INVITE_MAX_DISMISSALS = 2;
