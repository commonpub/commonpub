/**
 * Component tests for `/admin/data-sharing`, the recipients admin and the
 * disclosure panel.
 *
 * What this screen can get wrong is not a layout bug. It is an operator
 * configuring an onward transfer of members' personal data while believing
 * something untrue about it. So the assertions below are about the four
 * statements the page exists to make, in the places it has to make them:
 *
 *  1. an unpapered joint or independent controller renders its warning, and the
 *     warning says the refusal is NOT scoped to that recipient (this is the one
 *     nobody guesses);
 *  2. saving moves the consent scope digest, and that is said BEFORE Save, not
 *     in a toast afterwards;
 *  3. a recipient the config parser refused is reported rather than silently
 *     absent, because an empty list with no error reads as "the feature does
 *     not work";
 *  4. the disclosure panel counts recipients and never names members, because
 *     which members a recipient saw is that member's own record.
 *
 * Everything is asserted through the rendered DOM against the REAL route
 * contracts, which the last block pins so the page's hand-written DTOs cannot
 * drift away from them silently.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed, watch, reactive, type Ref } from 'vue';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// --- Wire fixtures, shaped exactly like the route responses ------------------

interface WireRecipient {
  id: string;
  name: string;
  url?: string;
  privacyPolicyUrl: string;
  purposes: string[];
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
  agreementRef?: string;
  country?: string;
  transferMechanism?: 'adequacy' | 'scc' | 'bcr' | 'derogation';
  source: 'config' | 'database';
  shadowedByConfig: boolean;
  unpapered: boolean;
}

interface WirePurpose {
  id: string;
  label: string;
  offerable: boolean;
  blocker: string | null;
  requiresRecipients: boolean;
  requiresAggregatableField: boolean;
  recipientIds: string[];
}

interface WireRecipients {
  configRecipients: WireRecipient[];
  storedRecipients: WireRecipient[];
  configError: string | null;
  droppedConfigEntries: Array<{ index: number; id: string | null; error: string }>;
  purposes: WirePurpose[];
  offeredPurposes: string[];
  scopeDigest: string;
  policyVersion: string;
  maxStoredRecipients: number;
  disclosureRetentionYears: number;
  flags: { dataSharingConsents: boolean; memberDirectory: boolean };
}

interface WireDisclosures {
  months: string[];
  recipients: Array<{
    recipientId: string;
    name: string | null;
    removed: boolean;
    months: Array<{ month: string; members: number; disclosures: number }>;
    totalMembers: number;
    totalDisclosures: number;
    lastDisclosedAt: string | null;
  }>;
  since: string;
  monthsRequested: number;
  disclosureRetentionYears: number;
  empty: boolean;
}

const PURPOSES: WirePurpose[] = [
  {
    id: 'profile_analytics',
    label: 'Count my answers in community statistics',
    offerable: true,
    blocker: null,
    requiresRecipients: false,
    requiresAggregatableField: true,
    recipientIds: [],
  },
  {
    id: 'recruiter_visibility',
    label: 'Let people hiring see my profile in the members directory',
    offerable: false,
    blocker: 'not_offered_in_release',
    requiresRecipients: true,
    requiresAggregatableField: false,
    recipientIds: ['acme'],
  },
  {
    id: 'sponsor_sharing',
    label: 'Share my answers with contest sponsors',
    offerable: false,
    blocker: 'no_recipient',
    requiresRecipients: true,
    requiresAggregatableField: false,
    recipientIds: [],
  },
];

function acme(overrides: Partial<WireRecipient> = {}): WireRecipient {
  return {
    id: 'acme',
    name: 'Acme Robotics',
    privacyPolicyUrl: 'https://acme.example/privacy',
    purposes: ['recruiter_visibility'],
    relationship: 'processor',
    source: 'config',
    shadowedByConfig: false,
    unpapered: false,
    ...overrides,
  };
}

function makeRecipients(overrides: Partial<WireRecipients> = {}): WireRecipients {
  return {
    configRecipients: [acme()],
    storedRecipients: [],
    configError: null,
    droppedConfigEntries: [],
    purposes: JSON.parse(JSON.stringify(PURPOSES)) as WirePurpose[],
    offeredPurposes: ['profile_analytics'],
    scopeDigest: 'a1b2c3d4e5f60718',
    policyVersion: '1',
    maxStoredRecipients: 50,
    disclosureRetentionYears: 2,
    flags: { dataSharingConsents: false, memberDirectory: false },
    ...overrides,
  };
}

function makeDisclosures(overrides: Partial<WireDisclosures> = {}): WireDisclosures {
  return {
    months: ['2026-07', '2026-08'],
    recipients: [
      {
        recipientId: 'acme',
        name: 'Acme Robotics',
        removed: false,
        months: [
          { month: '2026-07', members: 12, disclosures: 30 },
          { month: '2026-08', members: 4, disclosures: 4 },
        ],
        totalMembers: 14,
        totalDisclosures: 34,
        lastDisclosedAt: '2026-08-04T10:00:00.000Z',
      },
    ],
    since: '2026-07-01T00:00:00.000Z',
    monthsRequested: 12,
    disclosureRetentionYears: 2,
    empty: false,
    ...overrides,
  };
}

// --- Auto-import stubs -----------------------------------------------------

const personaFlag = ref(true);
const canSettingsFlag = ref(true);
const recipientsRef: Ref<WireRecipients | null> = ref(makeRecipients());
const disclosuresRef: Ref<WireDisclosures | null> = ref(makeDisclosures());
const pendingRef = ref(false);
const errorRef: Ref<unknown> = ref(null);
const disclosuresErrorRef: Ref<unknown> = ref(null);

const refresh = vi.fn(async () => {});
const refreshDisclosures = vi.fn(async () => {});
const toastSuccess = vi.fn();
const toastError = vi.fn();
// Parameters declared even though the default implementation ignores them:
// `vi.fn(async () => ...)` types every recorded call as the empty tuple, so
// `mock.calls[0][1]` is a type error and the body assertion below cannot be
// written at all.
const $fetch = vi.fn(
  async (_url: string, _options?: { method?: string; body?: unknown }) => ({
    storedRecipients: [] as unknown[],
    cleared: false,
    previousScopeDigest: 'a1b2c3d4e5f60718',
    scopeDigest: 'ffffffffffffffff',
    grantsNeedReconfirmation: true,
  }),
);

/** Records the options each fetch was given, so gating can be asserted on the CALL. */
const fetchCalls: Array<{ url: string; options: Record<string, unknown> }> = [];

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useCan: () => computed(() => canSettingsFlag.value),
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useFeatures: () => ({ persona: computed(() => personaFlag.value) }),
  useFetch: (url: string, options: Record<string, unknown>) => {
    fetchCalls.push({ url, options });
    return url.includes('disclosures')
      ? {
          data: disclosuresRef,
          pending: pendingRef,
          refresh: refreshDisclosures,
          error: disclosuresErrorRef,
        }
      : { data: recipientsRef, pending: pendingRef, refresh, error: errorRef };
  },
  $fetch,
  computed,
  ref,
  watch,
  reactive,
});

const DataSharingPage = (await import('../data-sharing.vue')).default;

/**
 * Vue reports a template referring to a name the script does not export as a
 * console warning and renders the surrounding markup anyway. On this page that
 * is a compliance control that silently is not there. Every warning fails.
 */
const vueWarnings: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  fetchCalls.length = 0;
  refresh.mockClear();
  refreshDisclosures.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  $fetch.mockClear();
  personaFlag.value = true;
  canSettingsFlag.value = true;
  pendingRef.value = false;
  errorRef.value = null;
  disclosuresErrorRef.value = null;
  recipientsRef.value = makeRecipients();
  disclosuresRef.value = makeDisclosures();
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
  return render(DataSharingPage, {
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  });
}

function text(container: Element): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Fill a blank draft with everything a recipient needs except the papering. */
async function addRecipient(
  container: Element,
  getByText: (t: string) => HTMLElement,
  fields: { relationship?: string; agreement?: string; purpose?: boolean } = {},
): Promise<void> {
  await fireEvent.click(getByText('Add recipient'));

  // The LAST match, always. `querySelector` returns the FIRST, which is an
  // already-saved row when the list is not empty, so a helper written that way
  // silently edits the wrong recipient and the duplicate-id test can never see
  // a duplicate.
  const last = <T extends Element>(selector: string): T => {
    const all = [...container.querySelectorAll(selector)];
    expect(all.length, selector).toBeGreaterThan(0);
    return all[all.length - 1] as T;
  };

  await fireEvent.update(last<HTMLInputElement>('input[id^="cpub-recipient-name-"]'), 'Globex');
  await fireEvent.update(last<HTMLInputElement>('input[id^="cpub-recipient-id-"]'), 'globex');
  await fireEvent.update(
    last<HTMLInputElement>('input[id^="cpub-recipient-policy-"]'),
    'https://globex.example/privacy',
  );
  if (fields.relationship !== undefined) {
    await fireEvent.update(
      last<HTMLSelectElement>('select[id^="cpub-recipient-relationship-"]'),
      fields.relationship,
    );
  }
  if (fields.agreement !== undefined) {
    await fireEvent.update(
      last<HTMLInputElement>('input[id^="cpub-recipient-agreement-"]'),
      fields.agreement,
    );
  }
  if (fields.purpose === true) {
    // The last fieldset's third purpose checkbox: sponsor_sharing.
    const fieldsets = [...container.querySelectorAll('fieldset')];
    const boxes = [...(fieldsets[fieldsets.length - 1]?.querySelectorAll('.cpub-sharing-choice input') ?? [])];
    expect(boxes).toHaveLength(3);
    await fireEvent.click(boxes[2] as HTMLInputElement);
  }
}

// --- The unpapered warning: the assertion this page exists for --------------

describe('/admin/data-sharing — an unpapered recipient renders its warning', () => {
  it('warns as soon as the relationship is set to joint controller with no agreement', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { relationship: 'joint_controller' });

    const body = text(container);
    expect(body).toContain('A joint controller needs an agreement reference.');
    expect(body).toContain('this site will not offer');
  });

  it('says the refusal is NOT scoped to the recipient that caused it', async () => {
    // The surprising half, and the reason this warning exists at all:
    // `purposeIsOfferable` refuses the purpose for EVERY covering recipient.
    // An operator who reads "this recipient will not receive data" and adds a
    // second, papered one has made things no better and does not know it.
    const { container, getByText } = mount();
    await addRecipient(container, getByText, {
      relationship: 'independent_controller',
      purpose: true,
    });

    expect(text(container)).toContain(
      'including for every other recipient named for the same purpose, so nothing is shared with anybody under it',
    );
  });

  it('names the purposes the draft claims, so the cost is concrete', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, {
      relationship: 'joint_controller',
      purpose: true,
    });

    expect(text(container)).toContain('Share my answers with contest sponsors');
  });

  it('clears the warning once an agreement reference is filled in', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, {
      relationship: 'joint_controller',
      agreement: 'DPA-2026-004',
    });

    expect(text(container)).not.toContain('needs an agreement reference.');
  });

  it('renders no warning for a processor, which needs no agreement', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText);

    expect(text(container)).not.toContain('needs an agreement reference.');
  });

  it('renders the warning on a SAVED recipient too, not only in the form', () => {
    // A warning that lives only in the draft is a warning nobody sees again
    // after they save. The route carries `unpapered` for exactly this.
    recipientsRef.value = makeRecipients({
      configRecipients: [
        acme({ relationship: 'joint_controller', unpapered: true }),
      ],
    });
    const { container } = mount();

    expect(text(container)).toContain(
      'joint controller with no agreement reference, so nothing is offered to members under its purposes, for any recipient',
    );
  });

  it('blocks Save while a draft is unpapered, using the same schema the server writes with', async () => {
    const { container, getByText } = mount();
    // Purpose ticked, so the ONLY thing wrong with this draft is the papering:
    // an untouched draft fails `purposes` first and would prove nothing here.
    await addRecipient(container, getByText, {
      relationship: 'joint_controller',
      purpose: true,
    });

    const save = getByText('Save recipients') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    // The message is `dataRecipientSchema`'s own, not a second copy written
    // here: the sentence an operator reads while typing is the sentence the
    // write path would have produced.
    expect(text(container)).toContain(
      'agreementRef: A joint or independent controller needs an agreementRef',
    );
  });

  it('blocks Save on a draft with no purpose, which would receive nothing', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText);

    expect((getByText('Save recipients') as HTMLButtonElement).disabled).toBe(true);
    expect(text(container)).toContain('purposes:');
  });
});

// --- The digest cost --------------------------------------------------------

describe('/admin/data-sharing — the cost of saving is stated before Save', () => {
  it('renders the re-ask warning in the editor, not only in a toast afterwards', () => {
    const { container } = mount();
    expect(text(container)).toContain('Changing who receives member data asks everyone again.');
    expect(text(container)).toContain(
      'it does not carry over to a list they have not seen',
    );
  });

  it('shows the fingerprint members agreed against', () => {
    const { container } = mount();
    expect(text(container)).toContain('a1b2c3d4e5f60718');
    expect(text(container)).toContain("Members' agreements are recorded against this fingerprint.");
  });

  it('tells the operator that everyone will be re-asked when the digest actually moved', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { purpose: true });
    await fireEvent.click(getByText('Save recipients'));

    expect($fetch).toHaveBeenCalledWith('/api/admin/data-sharing/recipients', {
      method: 'PUT',
      body: { recipients: [expect.objectContaining({ id: 'globex' })] },
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      'Recipients saved. Everyone who already agreed will be asked again before anything is shared.',
    );
  });

  it('does not claim a re-ask when the route says the digest did not move', async () => {
    $fetch.mockResolvedValueOnce({
      storedRecipients: [],
      cleared: false,
      previousScopeDigest: 'a1b2c3d4e5f60718',
      scopeDigest: 'a1b2c3d4e5f60718',
      grantsNeedReconfirmation: false,
    });
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { purpose: true });
    await fireEvent.click(getByText('Save recipients'));

    expect(toastSuccess).toHaveBeenCalledWith('Recipients saved.');
  });

  it('sends no empty strings: an unset optional field is absent, not ""', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { purpose: true });
    await fireEvent.click(getByText('Save recipients'));

    const options = $fetch.mock.calls[0]?.[1];
    const sent = (options?.body as { recipients: unknown[] }).recipients[0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('country');
    expect(sent).not.toHaveProperty('agreementRef');
    expect(sent).not.toHaveProperty('transferMechanism');
    expect(sent).not.toHaveProperty('url');
  });
});

// --- What the config file said and the parser refused -----------------------

describe('/admin/data-sharing — a refused config recipient is reported, not silently absent', () => {
  it('names the index, the id and the reason', () => {
    recipientsRef.value = makeRecipients({
      configRecipients: [],
      droppedConfigEntries: [
        { index: 1, id: 'globex', error: 'privacyPolicyUrl: Invalid url' },
      ],
    });
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('recipients[1]');
    expect(body).toContain('globex');
    expect(body).toContain('privacyPolicyUrl: Invalid url');
    expect(body).toContain('A refused recipient is not in force and nothing is shared with it.');
  });

  it('says the whole file block was unreadable when it was', () => {
    recipientsRef.value = makeRecipients({
      configRecipients: [],
      configError: 'recipients.0.name: Too small',
    });
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('The data sharing block in commonpub.config.ts could not be read.');
    expect(body).toContain('No recipient from the config file is in force');
    expect(body).toContain('recipients.0.name: Too small');
  });

  it('says nothing about refusals when there are none', () => {
    const { container } = mount();
    expect(text(container)).not.toContain('could not be read');
    expect(text(container)).not.toContain('were refused');
  });
});

// --- Why a purpose is not offered -------------------------------------------

describe('/admin/data-sharing — a purpose that is not offered explains itself', () => {
  it('explains a deferred release rather than implying a misconfiguration', () => {
    const { container } = mount();
    expect(text(container)).toContain(
      'This site does not offer this choice to members yet. You can name recipients for it now, and they take effect when it is offered.',
    );
  });

  it('explains a missing recipient', () => {
    const { container } = mount();
    expect(text(container)).toContain(
      'No recipient is named for this purpose, so members are not asked about it and nothing is shared.',
    );
  });

  it('explains that one unpapered recipient withdraws the purpose from all of them', () => {
    const purposes = JSON.parse(JSON.stringify(PURPOSES)) as WirePurpose[];
    purposes[2]!.blocker = 'unpapered_recipient';
    purposes[2]!.recipientIds = ['acme', 'globex'];
    recipientsRef.value = makeRecipients({ purposes });
    const { container } = mount();

    expect(text(container)).toContain(
      'That withdraws this purpose from every recipient named for it, not only from that one',
    );
  });

  it('marks an offerable purpose as offered', () => {
    const { container } = mount();
    const pills = [...container.querySelectorAll('.cpub-sharing-pill-on')];
    expect(pills.map((p) => p.textContent?.trim())).toContain('Offered to members');
  });

  it('never renders an empty explanation under a Not offered pill', () => {
    const purposes = JSON.parse(JSON.stringify(PURPOSES)) as WirePurpose[];
    // A blocker the page does not know about must still produce a sentence.
    purposes[1]!.blocker = null;
    recipientsRef.value = makeRecipients({ purposes });
    const { container } = mount();

    expect(text(container)).toContain('This purpose is not offered to members on this site.');
  });
});

// --- The disclosure panel ---------------------------------------------------

describe('/admin/data-sharing — the disclosure panel makes bulk extraction visible', () => {
  it('prints distinct people and total reads per recipient', () => {
    const { container } = mount();
    const body = text(container);

    expect(body).toContain('Acme Robotics');
    expect(body).toContain('14');
    expect(body).toContain('34');
  });

  it('renders a month column per label with zeroes gap-filled by the route', () => {
    const { container } = mount();
    const headers = [...container.querySelectorAll('.cpub-sharing-table thead th')].map(
      (th) => th.textContent?.trim(),
    );
    expect(headers).toEqual(['Recipient', 'People', 'Reads', 'Last read', '2026-07', '2026-08']);
  });

  it('explains what the two numbers mean, since a bare pair invites the wrong reading', () => {
    const { container } = mount();
    expect(text(container)).toContain(
      'a much larger reads figure means the same people are being pulled again and again',
    );
  });

  it('names no member and offers no way to reach one', () => {
    // The whole point of the split: which members a recipient saw is the
    // MEMBER'S record, shown to them. An operator panel that listed them would
    // be a second directory with no consent behind it.
    const { container } = mount();
    const body = text(container);
    expect(body).toContain(
      "Which members a recipient saw is that member's own record and is shown to them on their privacy settings, not here.",
    );
    expect(container.querySelectorAll('a[href^="/u/"]')).toHaveLength(0);
  });

  it('says how long the record is kept, from the payload rather than a hardcoded 2', () => {
    recipientsRef.value = makeRecipients({ disclosureRetentionYears: 7 });
    const { container } = mount();
    expect(text(container)).toContain('Records are deleted after 7 years.');
  });

  it('keeps a removed recipient in the record and marks it', () => {
    const d = makeDisclosures();
    d.recipients[0]!.name = null;
    d.recipients[0]!.removed = true;
    disclosuresRef.value = d;
    const { container } = mount();

    expect(text(container)).toContain('acme');
    expect(text(container)).toContain('no longer declared');
  });

  it('renders the empty state rather than an empty table', () => {
    disclosuresRef.value = makeDisclosures({ recipients: [], empty: true });
    const { container } = mount();

    expect(text(container)).toContain('Nothing has been disclosed to anybody yet.');
    expect(container.querySelector('.cpub-sharing-table')).toBeNull();
  });

  it('asks the route for the window the operator picks', async () => {
    const { container } = mount();
    const select = container.querySelector('#cpub-sharing-months') as HTMLSelectElement;
    await fireEvent.update(select, '24');

    const call = fetchCalls.find((c) => c.url.includes('disclosures'));
    const query = (call?.options.query as { value?: { months?: number } } | undefined)?.value;
    expect(query?.months).toBe(24);
  });
});

// --- Not losing an operator's work ------------------------------------------

describe('/admin/data-sharing — unsaved edits survive a background refresh', () => {
  it('does not overwrite a half-typed list when the route answers again', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText);

    // A refresh lands while the operator is typing.
    recipientsRef.value = makeRecipients({ storedRecipients: [] });
    await new Promise((r) => setTimeout(r, 0));

    const id = container.querySelector('input[id^="cpub-recipient-id-"]') as HTMLInputElement;
    expect(id.value).toBe('globex');
  });

  it('discards on request, back to what the route last said', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText);
    await fireEvent.click(getByText('Discard changes'));

    expect(container.querySelector('input[id^="cpub-recipient-id-"]')).toBeNull();
    expect(text(container)).toContain('No recipient has been added here.');
  });

  it('refuses a duplicate id, which the whole-list write would reject anyway', async () => {
    recipientsRef.value = makeRecipients({
      storedRecipients: [acme({ id: 'globex', name: 'Globex', source: 'database' })],
    });
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { purpose: true });

    expect(text(container)).toContain('is already used above');
    expect((getByText('Save recipients') as HTMLButtonElement).disabled).toBe(true);
  });
});

// --- Gating -----------------------------------------------------------------

describe('/admin/data-sharing — gating renders nothing and asks for nothing', () => {
  const SENSITIVE = ['Acme Robotics', 'https://acme.example/privacy', 'a1b2c3d4e5f60718'];

  function expectNothingSensitive(container: Element): void {
    const body = text(container);
    for (const phrase of SENSITIVE) expect(body, phrase).not.toContain(phrase);
    expect(container.querySelector('.cpub-sharing-list')).toBeNull();
    expect(container.querySelector('.cpub-sharing-table')).toBeNull();
  }

  it('renders nothing and makes no request with the persona flag off', () => {
    personaFlag.value = false;
    const { container } = mount();

    expectNothingSensitive(container);
    expect(text(container)).toContain('The persona is not enabled on this instance.');
    for (const call of fetchCalls) expect(call.options.immediate).toBe(false);
  });

  it('renders nothing and makes no request without settings.manage', () => {
    canSettingsFlag.value = false;
    const { container } = mount();

    expectNothingSensitive(container);
    expect(text(container)).toContain(
      'You do not have permission to manage settings on this instance.',
    );
    for (const call of fetchCalls) expect(call.options.immediate).toBe(false);
  });

  it('keeps both payloads out of the SSR response', () => {
    mount();
    expect(fetchCalls).toHaveLength(2);
    for (const call of fetchCalls) expect(call.options.server).toBe(false);
  });
});

// --- Accessibility ----------------------------------------------------------

describe('/admin/data-sharing — accessibility', () => {
  it('has no axe violations in the states an operator actually meets', async () => {
    const states: WireRecipients[] = [
      makeRecipients(),
      makeRecipients({ configRecipients: [], storedRecipients: [] }),
      makeRecipients({ configError: 'recipients.0.name: Too small' }),
      makeRecipients({
        droppedConfigEntries: [{ index: 0, id: null, error: 'id: Invalid' }],
      }),
      makeRecipients({
        storedRecipients: [acme({ id: 'globex', name: 'Globex', source: 'database' })],
      }),
    ];
    for (const state of states) {
      recipientsRef.value = state;
      const { container } = mount();
      const results = await axe.run(container, {
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
      });
      expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
    }
    // Five full axe passes over a large page. Well inside vitest's 5s default
    // when this file runs alone, and NOT inside it when the whole layer suite is
    // competing for the machine, which is where it was first seen to time out.
    // The budget is the same one `accent-fill-contrast.test.ts` carries for the
    // same reason. A flaky a11y test gets muted, and a muted a11y test is worse
    // than no a11y test, because the badge stays green.
  }, 30_000);

  // axe over several rendered states is load-sensitive: ~2.7s alone, over the
  // 5s default under a full-suite run, which failed as a TIMEOUT and read as
  // an accessibility violation. Explicit budget; the work is unchanged.
  it('has no axe violations with the editor open', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText, { relationship: 'joint_controller' });
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  }, 30_000);

  it('names every section with a real heading', () => {
    const { container } = mount();
    const sections = [...container.querySelectorAll('section')];
    expect(sections.length).toBeGreaterThanOrEqual(4);
    for (const section of sections) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).not.toBeNull();
      expect(container.querySelector(`#${labelledBy}`)?.tagName).toBe('H2');
    }
  }, 30_000);

  it('labels every control in the editor', async () => {
    const { container, getByText } = mount();
    await addRecipient(container, getByText);

    const controls = [...container.querySelectorAll('fieldset input[type="text"], fieldset input[type="url"], fieldset select')];
    expect(controls.length).toBeGreaterThanOrEqual(7);
    for (const control of controls) {
      const id = control.getAttribute('id');
      expect(id, control.outerHTML).not.toBeNull();
      expect(container.querySelector(`label[for="${id}"]`), id ?? '?').not.toBeNull();
    }
  });
});

// --- Copy and style discipline ----------------------------------------------

describe('/admin/data-sharing — copy and style discipline', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pagePath = resolve(here, '../data-sharing.vue');
  const raw = readFileSync(pagePath, 'utf8');

  const templateBlock = ((): string => {
    const open = raw.indexOf('<template>');
    const close = raw.lastIndexOf('</template>');
    if (open === -1 || close === -1) return '';
    return raw.slice(open + '<template>'.length, close).replace(/<!--[\s\S]*?-->/g, '');
  })();

  it('the guard on the guard: it read a real file and extracted real template copy', () => {
    expect(raw.length).toBeGreaterThan(8000);
    expect(templateBlock.length).toBeGreaterThan(3000);
    expect(templateBlock).toContain('cpub-sharing-title');
    // Positive control on the comment stripper: this phrase is in an HTML
    // comment inside the template, so a broken stripper would keep it.
    expect(raw).toContain('The config file said something the parser refused');
    expect(templateBlock).not.toContain('The config file said something the parser refused');
  });

  it('contains no em dash in user-facing copy', () => {
    expect(templateBlock).not.toContain('—');
    // The script block holds several rendered sentences too (the blocker copy,
    // the digest warning), so it gets the same rule outside its comments.
    const script = raw.slice(0, raw.indexOf('<template>')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(script).not.toContain('—');
  });

  it('hardcodes no colour or font in its scoped styles', () => {
    const styleStart = raw.indexOf('<style');
    expect(styleStart).toBeGreaterThan(0);
    const style = raw.slice(styleStart).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/\brgba?\(/);
    expect(style).not.toMatch(/\bhsla?\(/);
    // Extracted rather than matched with a lookahead: `font-family:\s*(?!...)`
    // backtracks `\s*` to zero width and matches every declaration including
    // the compliant ones, which is a guard that can never fail.
    const fonts = [...style.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1]!.trim());
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font === 'inherit' || font.startsWith('var(--'), font).toBe(true);
    }
  });

  it('every token it reaches for is declared in packages/ui/theme, not the gitignored layer copy', () => {
    const style = raw.slice(raw.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '');
    const themeDir = resolve(here, '../../../../../packages/ui/theme');
    const theme =
      readFileSync(resolve(themeDir, 'base.css'), 'utf8') +
      readFileSync(resolve(themeDir, 'components.css'), 'utf8');
    expect(theme.length).toBeGreaterThan(10000);

    const used = new Set(
      [...style.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] as string),
    );
    expect(used.size).toBeGreaterThan(10);
    const missing = [...used].filter((token) => !theme.includes(`${token}:`));
    expect(missing, `tokens with no declaration in packages/ui/theme: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps interactive targets at the 44px AA floor', () => {
    const style = raw.slice(raw.indexOf('<style'));
    for (const rule of ['.cpub-sharing-input', '.cpub-sharing-btn', '.cpub-sharing-choice']) {
      const block = style.slice(style.indexOf(`${rule} {`));
      expect(block.slice(0, block.indexOf('}')), rule).toContain('min-height: 44px');
    }
  });
});

// --- Route contract ---------------------------------------------------------

describe('/admin/data-sharing — the route contracts this page mirrors', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const routeDir = resolve(here, '../../../server/api/admin/data-sharing');
  const get = readFileSync(resolve(routeDir, 'recipients.get.ts'), 'utf8');
  const put = readFileSync(resolve(routeDir, 'recipients.put.ts'), 'utf8');
  const disclosures = readFileSync(resolve(routeDir, 'disclosures.get.ts'), 'utf8');

  it('the guard on the guard: it read all three real route files', () => {
    let walked = 0;
    for (const [name, src] of [
      ['recipients.get.ts', get],
      ['recipients.put.ts', put],
      ['disclosures.get.ts', disclosures],
    ] as const) {
      expect(src.length, `${name} is empty; check the path`).toBeGreaterThan(1500);
      walked += 1;
    }
    expect(walked).toBe(3);
  });

  it('all three still enforce the gates this page mirrors in its chrome', () => {
    for (const src of [get, put, disclosures]) {
      expect(src).toContain("requireFeature('admin')");
      expect(src).toContain("requireFeature('persona')");
      expect(src).toContain("requirePermission(event, 'settings.manage')");
    }
  });

  it('the read still returns the two lists SEPARATELY, not one merged list', () => {
    // The whole reason the file half renders read only. A merged list would make
    // it look editable and hide which source an operator has to change.
    expect(get).toContain('configRecipients:');
    expect(get).toContain('storedRecipients:');
    for (const key of [
      'configError',
      'droppedConfigEntries',
      'purposes',
      'scopeDigest',
      'policyVersion',
      'maxStoredRecipients',
      'disclosureRetentionYears',
    ]) {
      expect(get, key).toContain(key);
    }
  });

  it('the read takes `offerable` from currentPurposeScope and never recomputes the gate', () => {
    expect(get).toContain('scope.offerablePurposes.includes(id)');
    expect(get).toContain('currentPurposeScope');
  });

  it('the write goes through setStoredRecipients, which validates with dataRecipientSchema', () => {
    expect(put).toContain('setStoredRecipients');
    expect(put).toContain('clearStoredRecipients');
    expect(put).toContain('grantsNeedReconfirmation');
    // Never the generic settings route, which takes `value: z.unknown()` and
    // would write past every refusal in the schema.
    expect(put).not.toContain('setInstanceSetting');
  });

  it('the disclosure route counts and never returns a member identity', () => {
    expect(disclosures).toContain('count(distinct');
    expect(disclosures).toContain('recipientId:');
    expect(disclosures).not.toMatch(/\busername\b/);
    // ISOLATION (plan D1): the accountability log and the k-anonymous aggregate
    // pipeline are opposites and must not share a code path.
    const withoutComments = disclosures
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(withoutComments).not.toContain('metrics');
    expect(withoutComments).not.toContain('minBucket');
    expect(withoutComments).not.toContain('bandPersonaCount');
  });

  it('the admin nav links to this page on the persona flag and settings.manage', () => {
    const layout = readFileSync(resolve(here, '../../../layouts/admin.vue'), 'utf8');
    expect(layout.length).toBeGreaterThan(2000);
    expect(layout).toContain('to="/admin/data-sharing"');
    expect(layout).toMatch(/v-if="persona && canSettings" to="\/admin\/data-sharing"/);
  });
});
