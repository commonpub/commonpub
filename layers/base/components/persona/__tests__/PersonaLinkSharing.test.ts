/**
 * `<PersonaLinkSharing>` — the per-platform link sharing control (plan phase 3,
 * R3.1 D6).
 *
 * Four properties are load-bearing and each is pinned below.
 *
 * 1. A platform the member has NOT filled in gets no toggle. The route already
 *    filters those out, so this is a statement about the component not inventing
 *    rows from a platform list.
 * 2. Nothing renders at all when sharing is not offered. An instance running
 *    `persona` for operational questions with no recruiter or sponsor ambitions
 *    must see no sharing language anywhere, and "recruiter sharing is off" is
 *    still sharing language (plan R2.3).
 * 3. Default off. `user_shared_links` is row-present-means-shared, so a member
 *    who has never touched this control shares nothing, and the switch must say
 *    so rather than defaulting to on and waiting to be corrected.
 * 4. The write is a whole-set replacement. Turning the LAST platform off must
 *    send `[]` and not be short-circuited as "nothing to do", which is the
 *    off-by-one that makes a withdrawal impossible.
 *
 * The copy assertion is not decoration either: the whole correction exists
 * because members read "share my GitHub" as "put my GitHub on my profile". The
 * first sentence has to say which of the two this is.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { computed, ref } from 'vue';
import axe from 'axe-core';
import LinkSharing from '../PersonaLinkSharing.vue';

interface Row {
  key: string;
  label: string;
  url: string;
  shared: boolean;
}
interface Payload {
  platforms: Row[];
  sharingOffered: boolean;
}

function payload(overrides: Partial<Payload> = {}): Payload {
  return {
    platforms: [
      { key: 'github', label: 'GitHub', url: 'https://github.com/ada', shared: false },
      { key: 'mastodon', label: 'Mastodon', url: 'https://hachyderm.io/@ada', shared: true },
    ],
    sharingOffered: true,
    ...overrides,
  };
}

let personaFlag = true;
let sharingFlag = true;
let fetched: Payload | null = payload();

/** Every PUT body the component sent, so "what did it actually write" is answerable. */
let writes: Array<{ platforms: string[] }> = [];
let writeFails = false;

const $fetch = vi.fn(async (_url: string, opts: { body: { platforms: string[] } }) => {
  writes.push(opts.body);
  if (writeFails) throw new Error('nope');
  const next = payload({
    platforms: (fetched?.platforms ?? []).map((r) => ({
      ...r,
      shared: opts.body.platforms.includes(r.key),
    })),
  });
  return next;
});

Object.assign(globalThis, {
  useFeatures: () => ({
    persona: computed(() => personaFlag),
    dataSharingConsents: computed(() => sharingFlag),
  }),
  useLazyFetch: () => ({
    data: ref(fetched),
    pending: computed(() => fetched === null),
  }),
  $fetch,
});

// NuxtLink is not registered outside a Nuxt app. Registering it as a real anchor
// keeps the "no href to a stored URL" assertion honest: if the component ever
// linked one, it would resolve and be caught rather than rendering as nothing.
const NuxtLink = {
  props: { to: { type: String, required: true } },
  template: '<a :href="to"><slot /></a>',
};

function mount() {
  return render(LinkSharing, { global: { components: { NuxtLink } } });
}

beforeEach(() => {
  $fetch.mockClear();
  personaFlag = true;
  sharingFlag = true;
  fetched = payload();
  writes = [];
  writeFails = false;
});

describe('PersonaLinkSharing — when it renders nothing at all', () => {
  it('renders nothing while the fetch has not resolved, not a row of Off switches', () => {
    fetched = null;
    const { container } = mount();
    expect(container.textContent?.trim()).toBe('');
    expect(container.querySelector('[role="switch"]')).toBeNull();
  });

  it('renders nothing when the persona flag is off', () => {
    personaFlag = false;
    const { container } = mount();
    expect(container.textContent?.trim()).toBe('');
  });

  /**
   * The makerspace case (plan R2.3). With the sharing flag off, no sharing
   * language may appear ANYWHERE, so this is asserted on the whole rendered
   * text rather than on the absence of switches: a heading reading "Sharing
   * these links" over an explanation of why nothing is shared would still teach
   * a member that recruiters are somewhere in this software.
   */
  it('renders nothing when the sharing flag is off, not an explanation of what is off', () => {
    sharingFlag = false;
    const { container } = mount();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text.trim()).toBe('');
    for (const word of ['shar', 'recruit', 'sponsor', 'recipient']) {
      expect(text, word).not.toContain(word);
    }
  });

  it('renders nothing when the server says sharing is not offered, whatever the flag says', () => {
    // A flag with no declared recipient offers nothing. The server decides, and
    // the component does not second-guess it from the flag alone.
    fetched = payload({ sharingOffered: false });
    const { container } = mount();
    expect(container.textContent?.trim()).toBe('');
  });

  it('renders nothing when the member has filled in no link at all', () => {
    fetched = payload({ platforms: [] });
    const { container } = mount();
    expect(container.textContent?.trim()).toBe('');
  });
});

describe('PersonaLinkSharing — one row per filled link', () => {
  it('renders a switch for each platform the member filled in, and no others', () => {
    const { container } = mount();
    const switches = [...container.querySelectorAll('[role="switch"]')];
    expect(switches).toHaveLength(2);
    const labels = [...container.querySelectorAll('.cpub-link-sharing-label')].map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toEqual(['GitHub', 'Mastodon']);
  });

  it('never offers a toggle for a platform with no address', () => {
    // The route filters these out; this pins that the component renders the
    // payload rather than a platform list of its own.
    fetched = payload({
      platforms: [{ key: 'github', label: 'GitHub', url: 'https://github.com/ada', shared: false }],
    });
    const { container, queryByText } = mount();
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(1);
    expect(queryByText('Mastodon')).toBeNull();
  });

  it('is off by default: an untouched platform reads Off, never On', () => {
    const { container } = mount();
    const first = container.querySelectorAll('[role="switch"]')[0]!;
    expect(first.getAttribute('aria-checked')).toBe('false');
    expect(first.textContent).toContain('Off');
  });

  it('shows a platform the member already shares as on', () => {
    const { container } = mount();
    const second = container.querySelectorAll('[role="switch"]')[1]!;
    expect(second.getAttribute('aria-checked')).toBe('true');
  });

  it('prints the address as text and never as a link to it', () => {
    const { container, getByText } = mount();
    expect(getByText('https://github.com/ada')).toBeTruthy();
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    // The one anchor is the internal pointer at the privacy page.
    expect(hrefs).toEqual(['/settings/privacy']);
  });

  it('names each switch by its platform and describes it by its state', () => {
    const { container } = mount();
    for (const node of container.querySelectorAll('[role="switch"]')) {
      const labelledBy = node.getAttribute('aria-labelledby');
      const describedBy = node.getAttribute('aria-describedby');
      expect(container.querySelector(`#${labelledBy}`)).not.toBeNull();
      expect(container.querySelector(`#${describedBy}`)).not.toBeNull();
    }
  });
});

describe('PersonaLinkSharing — the copy says which question this is', () => {
  it('says the address is already on the profile and that this does not change that', () => {
    const { container } = mount();
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain(
      'These addresses are on your public profile already, and nothing here changes that.',
    );
  });

  it('states the honest limit of turning one off', () => {
    const { container } = mount();
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('It cannot recall what was already shared.');
  });

  it('describes each row as included or not, never as visible or hidden', () => {
    const { container } = mount();
    const states = [...container.querySelectorAll('.cpub-link-sharing-state')].map((n) =>
      n.textContent?.trim(),
    );
    expect(states).toEqual([
      'Not included. It stays on your profile.',
      'Included when your details are sent.',
    ]);
  });
});

describe('PersonaLinkSharing — writing', () => {
  it('sends the WHOLE set, not the one that changed', async () => {
    const { container } = mount();
    await fireEvent.click(container.querySelectorAll('[role="switch"]')[0]!);
    // github flipped on, mastodon already on.
    expect(writes).toEqual([{ platforms: ['github', 'mastodon'] }]);
  });

  /**
   * The withdrawal path, and the one most likely to be broken by an
   * optimisation. Turning the last shared platform off must send an EMPTY list.
   * A route or a client that treats "nothing to send" as "nothing to do" makes
   * withdrawing a disclosure impossible.
   */
  it('sends an empty list when the member turns the last one off', async () => {
    fetched = payload({
      platforms: [
        { key: 'github', label: 'GitHub', url: 'https://github.com/ada', shared: false },
        { key: 'mastodon', label: 'Mastodon', url: 'https://hachyderm.io/@ada', shared: true },
      ],
    });
    const { container } = mount();
    await fireEvent.click(container.querySelectorAll('[role="switch"]')[1]!);
    expect(writes).toEqual([{ platforms: [] }]);
  });

  it('re-renders from what the server stored, not from its own guess', async () => {
    const { container } = mount();
    await fireEvent.click(container.querySelectorAll('[role="switch"]')[0]!);
    const first = container.querySelectorAll('[role="switch"]')[0]!;
    expect(first.getAttribute('aria-checked')).toBe('true');
  });

  it('puts the switch back and says so when the write fails', async () => {
    writeFails = true;
    const { container, findByRole } = mount();
    await fireEvent.click(container.querySelectorAll('[role="switch"]')[0]!);
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Nothing has changed');
    // The control must not stay where the member left it after a failed write:
    // a switch that lies about a disclosure is the worst failure this surface
    // can have.
    expect(container.querySelectorAll('[role="switch"]')[0]!.getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('writes once per click, even when a second click lands mid-flight', async () => {
    const { container } = mount();
    const first = container.querySelectorAll('[role="switch"]')[0]!;
    await Promise.all([fireEvent.click(first), fireEvent.click(first)]);
    expect($fetch).toHaveBeenCalledTimes(1);
  });
});

describe('PersonaLinkSharing — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
