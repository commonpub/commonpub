/**
 * `<PersonaInvitationBanner>` — plan 10.2's "renders nothing until status
 * resolves, never a zero meter; second dismissal is terminal".
 *
 * Two of these exist because of shipped bugs, not theory. "Renders nothing until
 * resolved" is the session-253 false-zero class on a per-viewer surface.
 * "Persistent, not per-session" is the soft-nag class: a session cookie re-asks
 * someone who has answered nothing every single session, forever.
 *
 * The cookie is the SEAM with `server/api/persona/status.get.ts`, which READS
 * what this component WRITES, so the tests below pin the shape of the value
 * (a decimal count, not a boolean) rather than only its presence. A boolean
 * cookie would make the server's `dismissals < 2` threshold unreachable and the
 * invitation would return forever.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { computed, ref } from 'vue';
import axe from 'axe-core';
import Banner from '../PersonaInvitationBanner.vue';

interface Status {
  enabled: boolean;
  offer?: boolean;
  hasAnyAnswer: boolean;
  completeness: { filled: number; total: number };
  dismissals: number;
}

const OFFERED: Status = {
  enabled: true,
  offer: true,
  hasAnyAnswer: false,
  completeness: { filled: 0, total: 9 },
  dismissals: 0,
};

const $fetch = vi.fn(async () => ({ ok: true }));

let flagOn = true;
let statusValue: Status | null = OFFERED;
let cookieValue: string | null = null;
let cookieName = '';
let cookieOptions: Record<string, unknown> = {};

Object.assign(globalThis, {
  useFeatures: () => ({ persona: computed(() => flagOn) }),
  useLazyFetch: () => ({ data: computed(() => statusValue), pending: computed(() => statusValue === null) }),
  useCookie: (name: string, opts: Record<string, unknown>) => {
    cookieName = name;
    cookieOptions = opts;
    const r = ref(cookieValue);
    return computed({
      get: () => r.value,
      set: (v: string | null) => { r.value = v; cookieValue = v; },
    });
  },
  $fetch,
});

// NuxtLink is not registered outside a Nuxt app; a plain anchor keeps the
// accessible-name and href assertions honest.
const NuxtLink = {
  props: { to: { type: String, required: true } },
  template: '<a :href="to"><slot /></a>',
};

function mount() {
  return render(Banner, { global: { components: { NuxtLink } } });
}

beforeEach(() => {
  $fetch.mockClear();
  flagOn = true;
  statusValue = { ...OFFERED };
  cookieValue = null;
  cookieName = '';
  cookieOptions = {};
});

describe('PersonaInvitationBanner — when it shows', () => {
  it('shows when the server offers it', () => {
    expect(mount().queryByRole('status')).not.toBeNull();
  });

  it('renders NOTHING at all until the status resolves', () => {
    statusValue = null;
    const { container, queryByRole } = mount();
    expect(queryByRole('status')).toBeNull();
    // Not a skeleton, not a placeholder, and above all not a zero: a
    // client-only count seeded into first paint is a false number in the HTML.
    expect(container.textContent?.trim()).toBe('');
    expect(container.textContent ?? '').not.toMatch(/\d/);
  });

  it('stays hidden when the feature flag is off', () => {
    flagOn = false;
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('stays hidden when the SERVER says the feature is off, whatever the client flag says', () => {
    statusValue = { ...OFFERED, enabled: false, offer: false };
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('stays hidden when the server declines to offer it', () => {
    statusValue = { ...OFFERED, offer: false };
    expect(mount().queryByRole('status')).toBeNull();
  });
});

describe('PersonaInvitationBanner — the server owns the decision', () => {
  // Split per case: testing-library queries are bound to document.body, so two
  // renders inside one `it` would see each other's output.
  //
  // A server that predates the `offer` field, built by omission.
  const LEGACY: Omit<Status, 'offer'> = {
    enabled: OFFERED.enabled,
    hasAnyAnswer: OFFERED.hasAnyAnswer,
    completeness: OFFERED.completeness,
    dismissals: OFFERED.dismissals,
  };

  it('offers when a pre-offer server says nothing is answered', () => {
    statusValue = { ...LEGACY };
    expect(mount().queryByRole('status')).not.toBeNull();
  });

  it('does not offer on the fallback path once any answer exists', () => {
    statusValue = { ...LEGACY, hasAnyAnswer: true };
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('does not offer on the fallback path after two dismissals', () => {
    statusValue = { ...LEGACY, dismissals: 2 };
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('fails closed: no status and no flag means no nag', () => {
    statusValue = null;
    flagOn = false;
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('refuses to offer even against a server that says offer:true after two dismissals', () => {
    // Belt and braces on terminality: two refusals are two refusals, whatever
    // the payload claims.
    statusValue = { ...OFFERED, offer: true, dismissals: 2 };
    expect(mount().queryByRole('status')).toBeNull();
  });
});

describe('PersonaInvitationBanner — dismissal is persistent, not per-session', () => {
  it('writes the count the server reads, in the cookie the server reads', async () => {
    const { getByLabelText, queryByRole } = mount();
    await fireEvent.click(getByLabelText('Dismiss the profile invitation'));

    expect(queryByRole('status')).toBeNull();
    expect(cookieName).toBe('cpub-persona-invite-dismissed');
    // A DECIMAL COUNT, not '1' as a boolean flag: the route parses this with
    // parseInt and compares it against 2, so a boolean makes the terminal state
    // unreachable and the invitation returns forever.
    expect(cookieValue).toBe('1');
    // A session cookie (no maxAge) would re-ask every session forever.
    expect(cookieOptions.maxAge).toBe(60 * 60 * 24 * 365);
    expect(cookieOptions.path).toBe('/');
  });

  it('the second dismissal writes 2, which is the terminal value', async () => {
    cookieValue = '1';
    statusValue = { ...OFFERED, dismissals: 1, offer: true };
    const { getByLabelText } = mount();
    await fireEvent.click(getByLabelText('Dismiss the profile invitation'));
    expect(cookieValue).toBe('2');
  });

  it('never counts past the ceiling, even if the cookie was tampered with', async () => {
    cookieValue = '99';
    statusValue = { ...OFFERED, dismissals: 2, offer: true };
    const { queryByRole } = mount();
    // Already terminal, so there is nothing to click.
    expect(queryByRole('status')).toBeNull();
  });

  it('a fresh cookie jar still respects a server-counted second dismissal', () => {
    cookieValue = null; // e.g. another device
    statusValue = { ...OFFERED, dismissals: 2, offer: false };
    expect(mount().queryByRole('status')).toBeNull();
  });

  it('does not POST anything: the cookie IS the record the status route reads', async () => {
    const { getByLabelText } = mount();
    await fireEvent.click(getByLabelText('Dismiss the profile invitation'));
    // An invented /api/persona/dismiss route would 404 on every dismissal.
    expect($fetch).not.toHaveBeenCalled();
  });
});

describe('PersonaInvitationBanner — accessibility and shape', () => {
  it('announces politely and never interrupts', () => {
    const { queryByRole, container } = mount();
    expect(queryByRole('alert')).toBeNull();
    expect(queryByRole('status')).not.toBeNull();
    expect(container.querySelector('[aria-live="assertive"]')).toBeNull();
  });

  it('injects no heading and no second banner landmark', () => {
    const { container } = mount();
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    expect(container.querySelector('header,[role="banner"]')).toBeNull();
  });

  it('offers equal-weight choices, not a link beside a filled button', () => {
    const { getByText, getByLabelText } = mount();
    expect(getByText('Fill in your profile').className).toContain('cpub-btn-sm');
    expect(getByLabelText('Dismiss the profile invitation').className).toContain('cpub-btn-sm');
  });

  it('links to the permanent editor route', () => {
    expect(mount().getByText('Fill in your profile').getAttribute('href')).toBe('/settings/persona');
  });

  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
