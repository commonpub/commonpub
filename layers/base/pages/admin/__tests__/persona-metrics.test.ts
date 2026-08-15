/**
 * Component tests for `/admin/persona-metrics`, the operator audience dashboard.
 *
 * What this screen can get wrong is not a layout bug, it is a false statement.
 * Every number it prints has already been suppressed, floored and consent-joined
 * by the route, and the page's whole job is to keep saying so. So the assertions
 * below are about TRUTH rather than about structure:
 *
 *  1. the three plan 8.5 empty states render their exact agreed copy, and they
 *     track the payload's own thresholds rather than a hardcoded five;
 *  2. `asOf` and `quantum` travel with every published count, because a number
 *     without its as-of reads as live and a number without its quantum reads as
 *     exact;
 *  3. a purpose nobody can grant never renders as a zero;
 *  4. nothing sensitive renders when either flag is off or the permission is
 *     missing, and no request is even made.
 *
 * Everything is asserted through the rendered DOM against the REAL route
 * contract (`layers/base/server/api/admin/persona-metrics.get.ts`), which the
 * last block of this file pins so the page's hand-written DTO cannot drift away
 * from it silently.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed, watch, type Ref } from 'vue';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// --- Wire fixtures, shaped exactly like AdminPersonaMetricsResponse ---------

interface WireOption {
  value: string;
  label: string;
}

interface WireField {
  sectionKey: string;
  fieldKey: string;
  label: string;
  multiValued: boolean;
  options: WireOption[];
}

interface WireDistribution {
  field: string;
  label: string;
  items: Array<{ value: string; label: string; count: number }>;
  suppressed: number;
  quantum: number;
  available: boolean;
  reason?: string;
  asOf: string | null;
}

interface WireLinks {
  items: Array<{ platform: string; label: string; count: number; authenticitySignal: boolean }>;
  suppressed: number;
  quantum: number;
  available: boolean;
  reason?: string;
  asOf: string | null;
}

type WireAudienceCount =
  | { available: true; count: number }
  | { available: false; reason: string };

interface WireAudience {
  sharingAnalytics: WireAudienceCount;
  openToRecruiters: WireAudienceCount;
  openToSponsorSharing: WireAudienceCount;
  quantum: number;
  available: boolean;
  reason?: string;
  asOf: string | null;
}

interface WireResponse {
  fields: WireField[];
  distribution: WireDistribution | null;
  links: WireLinks;
  audience: WireAudience | null;
  thresholds: { minBucket: number; minPopulation: number };
  quantum: number;
  asOf: null;
}

const FIELDS: WireField[] = [
  {
    sectionKey: 'interests',
    fieldKey: 'interests',
    label: 'What are you into?',
    multiValued: true,
    options: [
      { value: 'pcb_design', label: 'PCB design' },
      { value: 'cnc', label: 'CNC' },
      { value: 'firmware', label: 'Firmware' },
    ],
  },
  {
    sectionKey: 'basics',
    fieldKey: 'industry',
    label: 'Industry',
    multiValued: false,
    options: [
      { value: 'hardware', label: 'Hardware' },
      { value: 'software', label: 'Software' },
    ],
  },
];

function makeResponse(overrides: Partial<WireResponse> = {}): WireResponse {
  return {
    fields: JSON.parse(JSON.stringify(FIELDS)) as WireField[],
    distribution: {
      field: 'interests',
      label: 'What are you into?',
      items: [
        { value: 'pcb_design', label: 'PCB design', count: 20 },
        { value: 'cnc', label: 'CNC', count: 10 },
      ],
      suppressed: 1,
      quantum: 5,
      available: true,
      asOf: null,
    },
    links: {
      items: [
        { platform: 'github', label: 'GitHub', count: 25, authenticitySignal: true },
        { platform: 'linkedin', label: 'LinkedIn', count: 10, authenticitySignal: false },
      ],
      suppressed: 0,
      quantum: 5,
      available: true,
      asOf: null,
    },
    audience: {
      sharingAnalytics: { available: true, count: 40 },
      openToRecruiters: { available: false, reason: 'purpose_not_offered' },
      openToSponsorSharing: { available: false, reason: 'purpose_not_offered' },
      quantum: 5,
      available: true,
      asOf: null,
    },
    thresholds: { minBucket: 5, minPopulation: 25 },
    quantum: 5,
    asOf: null,
    ...overrides,
  };
}

/** Every unavailable payload the route can hand this page, in one place. */
function unavailable(reason: string): Pick<WireResponse, 'distribution' | 'links' | 'audience'> {
  return {
    distribution: {
      field: 'interests',
      label: 'What are you into?',
      items: [],
      suppressed: 0,
      quantum: 5,
      available: false,
      reason,
      asOf: null,
    },
    links: { items: [], suppressed: 0, quantum: 5, available: false, reason, asOf: null },
    audience: {
      sharingAnalytics: { available: false, reason },
      openToRecruiters: { available: false, reason },
      openToSponsorSharing: { available: false, reason },
      quantum: 5,
      available: false,
      reason,
      asOf: null,
    },
  };
}

// --- Auto-import stubs -----------------------------------------------------

const refresh = vi.fn(async () => {});
const personaFlag = ref(true);
const analyticsFlag = ref(true);
const canAuditFlag = ref(true);
const responseRef: Ref<WireResponse | null> = ref(makeResponse());
const pendingRef = ref(false);
const errorRef: Ref<unknown> = ref(null);

/** Records the options the page passed, so gating can be asserted on the CALL. */
const fetchCalls: Array<{ url: string; options: Record<string, unknown> }> = [];

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useCan: () => computed(() => canAuditFlag.value),
  useFeatures: () => ({
    persona: computed(() => personaFlag.value),
    personaAnalytics: computed(() => analyticsFlag.value),
  }),
  useFetch: (url: string, options: Record<string, unknown>) => {
    fetchCalls.push({ url, options });
    return { data: responseRef, pending: pendingRef, refresh, error: errorRef };
  },
  computed,
  ref,
  watch,
});

const AudiencePage = (await import('../persona-metrics.vue')).default;

/**
 * Vue reports a template referring to a name the script does not export as a
 * console warning and then renders the surrounding markup anyway. On this page
 * that is a silent wrong number: the field picker would render with no
 * selection while the request still asked for a field. Every warning is a
 * failure here.
 */
const vueWarnings: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  refresh.mockClear();
  fetchCalls.length = 0;
  personaFlag.value = true;
  analyticsFlag.value = true;
  canAuditFlag.value = true;
  pendingRef.value = false;
  errorRef.value = null;
  responseRef.value = makeResponse();
  vueWarnings.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    vueWarnings.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  warnSpy?.mockRestore();
  warnSpy = null;
  expect(vueWarnings, vueWarnings.join('\n')).toHaveLength(0);
});

function mount(): ReturnType<typeof render> {
  return render(AudiencePage, {
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  });
}

function text(container: Element): string {
  // Collapse whitespace so a line broken across the template still matches the
  // agreed sentence exactly.
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// --- The three empty states ------------------------------------------------

describe('/admin/persona-metrics — the plan 8.5 empty states', () => {
  it('below the population floor, renders the agreed sentence with the payload threshold', () => {
    responseRef.value = makeResponse(unavailable('insufficient_population'));
    const { container } = mount();

    expect(text(container)).toContain(
      'There are not enough people sharing statistics yet to show totals safely. ' +
        'Totals appear once at least 25 people have turned sharing on.',
    );
  });

  it('takes the population floor from the payload rather than hardcoding 25', () => {
    // An operator who raised minPopulation must not be shown a sentence
    // understating their own floor. The copy is derived, not declared twice.
    responseRef.value = makeResponse({
      ...unavailable('insufficient_population'),
      thresholds: { minBucket: 5, minPopulation: 500 },
    });
    const { container } = mount();

    expect(text(container)).toContain('at least 500 people have turned sharing on.');
    expect(text(container)).not.toContain('at least 25 people have turned sharing on.');
  });

  it('with every bucket suppressed, renders the agreed sentence', () => {
    responseRef.value = makeResponse(unavailable('insufficient_bucket_diversity'));
    const { container } = mount();

    expect(text(container)).toContain('No answer has been chosen by at least five people yet.');
  });

  it('with no answers at all, says the same thing rather than printing an empty list', () => {
    // `available: true` with zero items is "nobody has answered", which is the
    // same statement to an operator and must not render as blank space.
    responseRef.value = makeResponse({
      distribution: {
        field: 'interests',
        label: 'What are you into?',
        items: [],
        suppressed: 0,
        quantum: 5,
        available: true,
        asOf: null,
      },
    });
    const { container } = mount();

    expect(text(container)).toContain('No answer has been chosen by at least five people yet.');
  });

  it('takes the bucket floor from the payload rather than hardcoding five', () => {
    responseRef.value = makeResponse({
      ...unavailable('insufficient_bucket_diversity'),
      thresholds: { minBucket: 25, minPopulation: 25 },
    });
    const { container } = mount();

    expect(text(container)).toContain('No answer has been chosen by at least 25 people yet.');
    expect(text(container)).not.toContain('at least five people yet.');
  });

  it('with no finalised day, renders the agreed sentence', () => {
    // The live admin read cannot return `no_snapshot_yet` today. The branch is
    // wired because plan 8.5 names it as one of this screen's three states, and
    // because the route is one word from being able to return it.
    responseRef.value = makeResponse(unavailable('no_snapshot_yet'));
    const { container } = mount();

    expect(text(container)).toContain(
      'Statistics are worked out once a day. The first set will appear after the next daily run.',
    );
  });

  it('renders the suppression explainer so an empty dashboard reads as working', () => {
    responseRef.value = makeResponse(unavailable('insufficient_population'));
    const { container } = mount();

    expect(text(container)).toContain(
      'Answers are only shown as totals when at least five people chose them, and totals ' +
        'are rounded. On a small instance most answers will be hidden. That is working correctly.',
    );
  });

  it('says in its own help text that the dashboard gets no exemption', () => {
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('This dashboard gets no exemption');
    expect(body).toContain('the same consent check, the same floors and the same rounding');
    expect(body).toContain('the agreement is with the member and not with the API');
  });
});

// --- Provenance ------------------------------------------------------------

describe('/admin/persona-metrics — every count carries its as-of and its quantum', () => {
  it('states the live reading and the rounding beside the audience, answers and links', () => {
    const { container } = mount();
    const body = text(container);

    // Three published surfaces, three provenance lines, each from that
    // payload's own asOf and quantum rather than from a page-level guess.
    const matches = body.match(
      /Live reading, taken when this page loaded\. Counts are rounded down to the nearest 5\./g,
    );
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(3);
  });

  it('names a finalised day when the payload carries one, instead of calling it live', () => {
    const base = makeResponse();
    responseRef.value = makeResponse({
      distribution: { ...base.distribution!, asOf: '2026-08-11', quantum: 10 },
      links: { ...base.links, asOf: '2026-08-11', quantum: 10 },
      audience: { ...base.audience!, asOf: '2026-08-11', quantum: 10 },
    });
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('Daily snapshot for 2026-08-11 (UTC). Counts are rounded down to the nearest 10.');
    expect(body).not.toContain('Live reading');
  });

  it('never prints a bare count without a provenance line in the same section', () => {
    const { container } = mount();
    // Every published number sits in a section, and every section that shows a
    // number shows its provenance. Assert per section rather than per page, so
    // one section losing its line cannot hide behind another section's.
    const sections = [...container.querySelectorAll('section')];
    expect(sections.length).toBeGreaterThanOrEqual(3);
    for (const section of sections) {
      const shows = section.querySelectorAll(
        '.cpub-audience-row-count, .cpub-audience-bar-count',
      ).length;
      if (shows === 0) continue;
      const provenance = section.querySelector('.cpub-audience-provenance');
      expect(provenance, section.querySelector('h2')?.textContent ?? '?').not.toBeNull();
      expect(provenance?.textContent ?? '').toMatch(/rounded down to the nearest \d+/);
    }
  });

  it('calls a withheld bucket an answer and never a person', () => {
    const { container } = mount();
    // `suppressed` is a BUCKET count. "1 person is hidden" would be a different,
    // false, and far more identifying statement.
    expect(text(container)).toContain('1 answer is hidden because fewer than five people chose it.');
  });
});

// --- Numbers ---------------------------------------------------------------

describe('/admin/persona-metrics — the numbers themselves', () => {
  it('prints each visible bucket as readable text, not only as a bar', () => {
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('PCB design');
    expect(body).toContain('20 people');
    expect(body).toContain('CNC');
    expect(body).toContain('10 people');
  });

  it('hides the bar from assistive technology, since the count is already text', () => {
    const { container } = mount();
    const tracks = [...container.querySelectorAll('.cpub-audience-bar-track')];
    expect(tracks.length).toBeGreaterThan(0);
    for (const track of tracks) expect(track.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the link presence counts, which is the operator’s stated goal', () => {
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('GitHub');
    expect(body).toContain('25 people');
    expect(body).toContain('LinkedIn');
  });

  it('never renders a purpose nobody can grant as a zero', () => {
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('Open to recruiters');
    expect(body).toContain('Not offered on this site.');
    // Word boundary, not substring: "10 people" ends in "0 people".
    expect(body).not.toMatch(/\b0 people/);
  });

  it('says nobody could opt in, rather than nobody did, when sharing consents are off', () => {
    responseRef.value = makeResponse({ audience: null });
    const { container } = mount();

    expect(text(container)).toContain(
      'Sharing choices are turned off, so nobody has been able to opt in.',
    );
    expect(text(container)).not.toMatch(/\b0 people/);
  });

  it('publishes no total, population or percentage of its own', () => {
    const { container } = mount();
    const body = text(container);

    // A denominator beside quantised buckets is the differencing oracle the
    // payload was shaped to prevent, and this page must not invent one.
    expect(body).not.toMatch(/\b\d+%/);
    expect(body.toLowerCase()).not.toContain('total of');
    expect(body.toLowerCase()).not.toContain('out of');
  });

  it('warns that a multi-answer question does not add up to a number of people', () => {
    const { container } = mount();
    expect(text(container)).toContain(
      'People can pick more than one answer here, so these totals do not add up to the number of people.',
    );
  });

  it('offers every countable field in the picker and asks for one of them', () => {
    const { container } = mount();
    const options = [...container.querySelectorAll('#cpub-audience-field option')];
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      'What are you into?',
      'Industry',
    ]);

    // Seeded from the response, so the operator lands on a breakdown rather
    // than on a prompt, and the request names a field the route will accept.
    const last = fetchCalls[fetchCalls.length - 1];
    const query = (last?.options.query as { value?: { field?: string } } | undefined)?.value;
    expect(query?.field).toBe('interests');

    // And the control AGREES with the request. A picker showing no selection
    // while the request names a field is a breakdown labelled with the wrong
    // question, which is worse than an empty screen.
    const select = container.querySelector('#cpub-audience-field') as HTMLSelectElement;
    expect(select.value).toBe('interests');
  });

  it('asks the route for the field the operator picks', async () => {
    const { container } = mount();
    const select = container.querySelector('#cpub-audience-field') as HTMLSelectElement;

    await fireEvent.update(select, 'industry');

    const query = (fetchCalls[fetchCalls.length - 1]?.options.query as
      | { value?: { field?: string } }
      | undefined)?.value;
    expect(query?.field).toBe('industry');
  });

  it('says the read failed rather than echoing the route message, and offers a retry', () => {
    // A stale key in the picker makes the route 400 with the key in its
    // message. The screen must not become a mirror of the route's wording.
    responseRef.value = null;
    errorRef.value = { statusCode: 400, message: 'Unknown persona field: gone' };
    const { container, getByRole } = mount();

    const alert = getByRole('alert');
    expect(alert.textContent).toContain('Statistics could not be loaded. Refresh to try again.');
    expect(text(container)).not.toContain('gone');
    expect(container.querySelector('.cpub-audience-bars')).toBeNull();
  });

  it('tells the operator to add a question when nothing is countable', () => {
    responseRef.value = makeResponse({ fields: [], distribution: null });
    const { container } = mount();

    expect(text(container)).toContain('No question on this profile can be counted yet.');
    expect(container.querySelector('#cpub-audience-field')).toBeNull();
  });
});

// --- Gating ----------------------------------------------------------------

describe('/admin/persona-metrics — gating renders nothing sensitive', () => {
  /** Every string that must never appear on a gated render. */
  const SENSITIVE = ['PCB design', '20 people', 'GitHub', '25 people', 'What are you into?', 'Industry'];

  function expectNothingSensitive(container: Element): void {
    const body = text(container);
    for (const phrase of SENSITIVE) expect(body, phrase).not.toContain(phrase);
    expect(container.querySelector('.cpub-audience-bars')).toBeNull();
    expect(container.querySelector('.cpub-audience-rows')).toBeNull();
    expect(container.querySelector('#cpub-audience-field')).toBeNull();
  }

  it('renders no numbers and makes no request with the persona flag off', () => {
    personaFlag.value = false;
    const { container } = mount();

    expectNothingSensitive(container);
    expect(text(container)).toContain('The persona is not enabled on this instance.');
    expect(fetchCalls[0]?.options.immediate).toBe(false);
  });

  it('renders no numbers and makes no request with the analytics flag off', () => {
    analyticsFlag.value = false;
    const { container } = mount();

    expectNothingSensitive(container);
    expect(text(container)).toContain('Audience analytics are not enabled on this instance.');
    expect(fetchCalls[0]?.options.immediate).toBe(false);
  });

  it('renders no numbers and makes no request without audit.read', () => {
    // The route enforces requirePermission('audit.read'), not settings.manage.
    canAuditFlag.value = false;
    const { container } = mount();

    expectNothingSensitive(container);
    expect(text(container)).toContain(
      'You do not have permission to read audience statistics on this instance.',
    );
    expect(fetchCalls[0]?.options.immediate).toBe(false);
  });

  it('keeps the data out of the SSR payload', () => {
    // Per-viewer, permission-gated data. `server: false` is the recorded rule
    // for exactly this shape, and it is also what makes the seeding watcher
    // below safe from a hydration mismatch.
    mount();
    expect(fetchCalls[0]?.options.server).toBe(false);
  });
});

// --- Accessibility ---------------------------------------------------------

describe('/admin/persona-metrics — accessibility', () => {
  // axe over several rendered states is load-sensitive: ~2.7s alone, over the
  // 5s default under a full-suite run, which failed as a TIMEOUT and read as
  // an accessibility violation. Explicit budget; the work is unchanged.
  it('has no axe violations with numbers, and none on each empty state', async () => {
    const states: WireResponse[] = [
      makeResponse(),
      makeResponse(unavailable('insufficient_population')),
      makeResponse(unavailable('insufficient_bucket_diversity')),
      makeResponse(unavailable('no_snapshot_yet')),
      makeResponse({ audience: null }),
      makeResponse({ fields: [], distribution: null }),
    ];
    for (const state of states) {
      responseRef.value = state;
      const { container } = mount();
      const results = await axe.run(container, {
        // Page-level rules do not apply to a mounted fragment.
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
      });
      expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
    }
  }, 30_000);

  it('names every section with a real heading, and labels the picker', () => {
    const { container } = mount();
    for (const section of container.querySelectorAll('section')) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).not.toBeNull();
      expect(container.querySelector(`#${labelledBy}`)?.tagName).toBe('H2');
    }
    const label = container.querySelector('label[for="cpub-audience-field"]');
    expect(label?.textContent?.trim()).toBe('Question');
  });

  it('gives the picker a 44px target, which neither form-input class declares', () => {
    // jsdom has no layout, so this is asserted on the rule rather than on a
    // measured box. The rule existing is the part that gets lost in an edit.
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(here, '../persona-metrics.vue'), 'utf8');
    expect(raw).toContain('.cpub-audience-picker .cpub-form-input {');
    expect(raw).toMatch(/\.cpub-audience-picker \.cpub-form-input \{[^}]*min-height: 44px/);
  });
});

// --- Copy discipline -------------------------------------------------------

describe('/admin/persona-metrics — copy discipline', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pagePath = resolve(here, '../persona-metrics.vue');
  const raw = readFileSync(pagePath, 'utf8');

  /** The `<template>` block with HTML comments removed. Comments are exempt. */
  const templateBlock = ((): string => {
    const open = raw.indexOf('<template>');
    const close = raw.lastIndexOf('</template>');
    if (open === -1 || close === -1) return '';
    return raw.slice(open + '<template>'.length, close).replace(/<!--[\s\S]*?-->/g, '');
  })();

  it('the guard on the guard: it read a real file and extracted real template copy', () => {
    // A broken path reads nothing and every assertion below passes green.
    expect(raw.length).toBeGreaterThan(4000);
    expect(templateBlock.length).toBeGreaterThan(1000);
    expect(templateBlock).toContain('cpub-audience-title');
    // Positive control on the stripper: this line is in the doc comment only.
    expect(raw).toContain('THE DASHBOARD GETS NO EXEMPTION');
    expect(templateBlock).not.toContain('THE DASHBOARD GETS NO EXEMPTION');
  });

  it('contains no em dash in user-facing copy', () => {
    expect(templateBlock).not.toContain('—');
  });

  it('never uses the gamification or urgency vocabulary the persona tree bans', () => {
    const lower = templateBlock.toLowerCase();
    for (const phrase of [
      'score',
      'streak',
      'leaderboard',
      'badge',
      'unlock',
      'reward',
      'level up',
      'we value your privacy',
      'improve your experience',
      "don't miss",
      'hurry',
    ]) {
      expect(lower, phrase).not.toContain(phrase);
    }
  });

  it('hardcodes no colour in its scoped styles', () => {
    const styleStart = raw.indexOf('<style');
    expect(styleStart).toBeGreaterThan(0);
    const style = raw.slice(styleStart).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/\brgba?\(/);
    expect(style).not.toMatch(/\bhsla?\(/);
    // And every token it reaches for is declared in packages/ui/theme, not in
    // the gitignored layer copy.
    const themePath = resolve(here, '../../../../../packages/ui/theme/components.css');
    const theme = readFileSync(themePath, 'utf8');
    expect(theme.length).toBeGreaterThan(1000);
    for (const token of [
      '--cpub-audience-note-bg',
      '--cpub-audience-note-border',
      '--cpub-audience-card-bg',
      '--cpub-audience-card-border',
      '--cpub-audience-bar-track-bg',
      '--cpub-audience-bar-fill-bg',
      '--cpub-audience-bar-height',
    ]) {
      expect(style, token).toContain(`var(${token})`);
      expect(theme, token).toContain(`${token}:`);
    }
  });
});

// --- Route contract --------------------------------------------------------

describe('/admin/persona-metrics — the route contract this page mirrors', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const routePath = resolve(here, '../../../server/api/admin/persona-metrics.get.ts');
  const route = readFileSync(routePath, 'utf8');

  it('the guard on the guard: it read the real route file', () => {
    expect(route.length).toBeGreaterThan(2000);
    expect(route).toContain('AdminPersonaMetricsResponse');
  });

  it('still enforces the gates this page mirrors in its chrome', () => {
    // If the route's gating changes, the nav entry and the three refusal blocks
    // on this page are wrong, and this is where that is caught.
    expect(route).toContain("requireFeature('persona')");
    expect(route).toContain("requireFeature('personaAnalytics')");
    expect(route).toContain("requirePermission(event, 'audit.read')");
  });

  it('still returns the keys the page reads, and still takes one field at a time', () => {
    for (const key of ['fields:', 'distribution:', 'links:', 'audience:', 'thresholds:', 'quantum:', 'asOf:']) {
      expect(route, key).toContain(key);
    }
    // The page's extra round trip exists because of this: one field per
    // request, and a distribution that is absent rather than empty when the
    // request did not name one. Pinned on the declaration, not on a comment.
    expect(route).toContain('field: z.string()');
    expect(route).toContain('distribution: PersonaDistribution | null;');
    // And `asOf` is null on this route because the read is live, which is why
    // the page prints "Live reading" rather than inventing a date.
    expect(route).toContain("source: 'live'");
  });

  it('the admin nav links to this page on both flags and on audit.read', () => {
    const layout = readFileSync(resolve(here, '../../../layouts/admin.vue'), 'utf8');
    expect(layout.length).toBeGreaterThan(2000);
    expect(layout).toContain('to="/admin/persona-metrics"');
    expect(layout).toMatch(/v-if="persona && personaAnalytics && canAudit"/);
  });
});
