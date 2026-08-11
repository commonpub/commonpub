/**
 * Component tests for the soft-verification nag banner (session 253).
 *
 * The visibility matrix is the whole contract: this banner renders on every page
 * of every instance that turns the flag on, so each way it should stay hidden is
 * a way it could otherwise nag the wrong person forever. The a11y assertions
 * matter for the same reason — a global element that announces itself
 * assertively, or injects a heading, degrades every page it appears on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed } from 'vue';
import axe from 'axe-core';
import Banner from '../EmailVerificationBanner.vue';

interface TestUser { id: string; email: string; emailVerified: boolean }

const $fetch = vi.fn(async () => ({ ok: true }));
const toastSuccess = vi.fn();
const toastError = vi.fn();

let flagOn = true;
let authUser: TestUser | null = null;
let cookieValue: string | null = null;

Object.assign(globalThis, {
  useFeatures: () => ({ emailVerification: computed(() => flagOn) }),
  useAuth: () => ({
    user: computed(() => authUser),
    isAuthenticated: computed(() => authUser !== null),
  }),
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useCookie: () => {
    const r = ref(cookieValue);
    // Mirror writes back so a dismissal is observable across a re-render.
    return computed({ get: () => r.value, set: (v: string | null) => { r.value = v; cookieValue = v; } });
  },
  $fetch,
});

function flush() { return new Promise((r) => setTimeout(r, 0)); }

const UNVERIFIED: TestUser = { id: 'u1', email: 'ada@example.com', emailVerified: false };

beforeEach(() => {
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({ ok: true }));
  toastSuccess.mockClear();
  toastError.mockClear();
  flagOn = true;
  authUser = { ...UNVERIFIED };
  cookieValue = null;
});

describe('EmailVerificationBanner — when it shows', () => {
  it('shows for a signed-in user with an unconfirmed address', () => {
    const { queryByRole, getByText } = render(Banner);
    expect(queryByRole('status')).not.toBeNull();
    expect(getByText(/ada@example\.com/)).toBeTruthy();
  });

  it('stays hidden when the feature flag is off', () => {
    flagOn = false;
    expect(render(Banner).queryByRole('status')).toBeNull();
  });

  it('stays hidden for a signed-out visitor', () => {
    authUser = null;
    expect(render(Banner).queryByRole('status')).toBeNull();
  });

  it('stays hidden once the address is confirmed', () => {
    authUser = { ...UNVERIFIED, emailVerified: true };
    expect(render(Banner).queryByRole('status')).toBeNull();
  });

  it('stays hidden after the user dismissed it this session', () => {
    cookieValue = '1';
    expect(render(Banner).queryByRole('status')).toBeNull();
  });
});

describe('EmailVerificationBanner — behaviour', () => {
  it('offers to send rather than claiming it already did', () => {
    // The population this flag exists for is every PRE-EXISTING account, and no
    // mail was ever sent to them — sendOnSignUp only fires at signup.
    const { getByText } = render(Banner);
    expect(getByText(/We can send a link/)).toBeTruthy();
  });

  it('resend POSTs the session-scoped route and never sends an address', async () => {
    const { getByText } = render(Banner);
    await fireEvent.click(getByText('Send link'));
    await flush();
    expect($fetch).toHaveBeenCalledWith('/api/user/resend-verification', { method: 'POST' });
    // The address must come from the session server-side; passing one from the
    // client is what would make this a mail relay.
    const [, opts] = $fetch.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(opts).not.toHaveProperty('body');
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('will not resend twice from one page load', async () => {
    const { getByText, queryByText } = render(Banner);
    await fireEvent.click(getByText('Send link'));
    await flush();
    // The button is replaced by the sent confirmation, so there is nothing to
    // double-click.
    expect(queryByText('Send link')).toBeNull();
    expect($fetch).toHaveBeenCalledTimes(1);
  });

  it('explains a 429 rather than reporting a generic failure', async () => {
    $fetch.mockImplementation(async () => { throw Object.assign(new Error('nope'), { statusCode: 429 }); });
    const { getByText } = render(Banner);
    await fireEvent.click(getByText('Send link'));
    await flush();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/wait a few minutes/i));
  });

  it('dismissing hides it and persists to the cookie', async () => {
    const { getByLabelText, queryByRole } = render(Banner);
    await fireEvent.click(getByLabelText(/dismiss the email confirmation reminder/i));
    await flush();
    expect(queryByRole('status')).toBeNull();
    expect(cookieValue).toBe('1');
  });
});

describe('EmailVerificationBanner — accessibility', () => {
  it('announces politely and does not interrupt: role=status, never role=alert', () => {
    const { container, queryByRole } = render(Banner);
    expect(queryByRole('alert')).toBeNull();
    expect(queryByRole('status')).not.toBeNull();
    // ARIA 1.2 gives status an implicit polite live region; an explicit
    // aria-live here would be redundant per spec (house convention).
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBeNull();
  });

  it('injects no heading and no second banner landmark', () => {
    const { container } = render(Banner);
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    expect(container.querySelector('header,[role="banner"]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(Banner);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
