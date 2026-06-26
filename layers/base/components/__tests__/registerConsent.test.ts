/**
 * Component test for the registration page's GDPR consent gate (session 227).
 *
 * Locks: the "Create account" button is disabled until the user ticks the
 * Terms/Code-of-Conduct + Privacy acceptance checkbox (an affirmative consent
 * act), and signUp is not called while unchecked.
 *
 * Page uses Nuxt auto-imports (definePageMeta, useSeoMeta, useSiteName, useAuth,
 * useRoute, useFeatures, navigateTo) — stub them on globalThis. Lives under
 * components/__tests__ (a bracket-free path) so the layer's files-array __tests__
 * exclusion packs it out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import RegisterPage from '../../pages/auth/register.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

const signUp = vi.fn(async () => {});

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useAuth: () => ({ signUp, user: ref(null) }),
  useRoute: () => ({ query: {} }),
  useFeatures: () => ({ referralLinks: ref(false) }),
  navigateTo: vi.fn(async () => {}),
});

function mount() {
  return render(RegisterPage, { global: { stubs: { NuxtLink } } });
}

beforeEach(() => {
  signUp.mockClear();
});

describe('registration consent gate', () => {
  function submitButton(container: Element): HTMLButtonElement {
    return Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create account'),
    ) as HTMLButtonElement;
  }

  it('disables the submit button until the consent checkbox is ticked', async () => {
    const { container } = mount();
    const btn = submitButton(container);
    expect(btn.disabled).toBe(true);

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    await fireEvent.click(checkbox);

    expect(btn.disabled).toBe(false);
  });

  it('does not call signUp while consent is unchecked (defensive guard)', async () => {
    const { container } = mount();
    const form = container.querySelector('form') as HTMLFormElement;
    await fireEvent.submit(form);
    expect(signUp).not.toHaveBeenCalled();
    // An inline error tells the user why.
    expect(container.textContent).toMatch(/accept the Terms/i);
  });
});
