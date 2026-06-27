/**
 * Component test for the GDPR terms re-acceptance interstitial (Phase 2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref } from 'vue';
import Gate from '../TermsReacceptanceGate.vue';

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a><slot /></a>' };

const $fetch = vi.fn(async (url: string) => (String(url).includes('status') ? { termsReacceptanceRequired: required } : { ok: true }));
let authUser: { id: string } | null = { id: 'u1' };
let required = true;
let routePath = '/dashboard';

Object.assign(globalThis, {
  useAuth: () => ({ user: ref(authUser) }),
  useRouter: () => ({ currentRoute: ref({ path: routePath }) }),
  $fetch,
});

function flush() { return new Promise((r) => setTimeout(r, 0)); }

beforeEach(() => {
  $fetch.mockClear();
  authUser = { id: 'u1' };
  required = true;
  routePath = '/dashboard';
});

describe('terms re-acceptance gate', () => {
  it('shows the blocking dialog when the server says re-acceptance is required, and accepting POSTs + hides it', async () => {
    const { container, queryByRole } = render(Gate, { global: { stubs: { NuxtLink } } });
    await flush(); // status fetch resolves
    expect(queryByRole('dialog')).toBeTruthy();
    expect($fetch).toHaveBeenCalledWith('/api/consent/status');

    await fireEvent.click(container.querySelector('button')!);
    expect($fetch).toHaveBeenCalledWith('/api/consent', { method: 'POST', body: { kind: 'terms' } });
    await flush();
    expect(queryByRole('dialog')).toBeNull();
  });

  it('stays hidden when re-acceptance is not required', async () => {
    required = false;
    const { queryByRole } = render(Gate, { global: { stubs: { NuxtLink } } });
    await flush();
    expect(queryByRole('dialog')).toBeNull();
  });

  it('does nothing for a logged-out user (no status fetch, no dialog)', async () => {
    authUser = null;
    const { queryByRole } = render(Gate, { global: { stubs: { NuxtLink } } });
    await flush();
    expect(queryByRole('dialog')).toBeNull();
    expect($fetch).not.toHaveBeenCalled();
  });

  it('suppresses itself on the legal pages so they stay readable, even when required', async () => {
    routePath = '/terms';
    const onTerms = render(Gate, { global: { stubs: { NuxtLink } } });
    await flush();
    expect(onTerms.queryByRole('dialog')).toBeNull();
    onTerms.unmount();

    routePath = '/privacy';
    const onPrivacy = render(Gate, { global: { stubs: { NuxtLink } } });
    await flush();
    expect(onPrivacy.queryByRole('dialog')).toBeNull();
  });
});
