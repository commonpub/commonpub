/**
 * Component test for `/privacy`, the policy page (member visibility directory
 * plan section 5.4).
 *
 * The audit finding this closes: the cookie banner and `/cookies` both link
 * across to Privacy settings, `/settings/privacy` renders every sentence of
 * consent copy from the purpose registry, and this page (the one a person can
 * read before signing up, and the one Art. 13 is actually about) described the
 * sharing purposes nowhere at all.
 *
 * The assertion that gives the section its value is the one comparing the
 * rendered text to `PROCESSING_PURPOSE_SPECS` character for character. A
 * paraphrase would pass a "does it mention recruiters" test forever while
 * drifting from the sentence members actually act on, which is the whole reason
 * the registry exists.
 *
 * Lives under components/__tests__ (bracket-free) for the same packaging reason
 * as `privacySettingsPage.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import { defineComponent, h, ref, computed } from 'vue';
import { PROCESSING_PURPOSES, PROCESSING_PURPOSE_SPECS } from '@commonpub/persona';
import PrivacyPolicyPage from '../../pages/privacy.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const sharingOn = ref(true);
const federationOn = ref(false);
const analyticsOn = ref(false);

const COOKIES = [
  {
    name: 'cpub-session',
    description: 'Keeps you signed in.',
    duration: '7 days',
    category: 'essential',
  },
];

Object.assign(globalThis, {
  useSeoMeta: () => {},
  useSiteName: () => 'Test Instance',
  useFeatures: () => ({
    federation: federationOn,
    analytics: analyticsOn,
    dataSharingConsents: sharingOn,
  }),
  useRuntimeConfig: () => ({ public: { analytics: undefined } }),
  useCookieConsent: () => ({ cookies: computed(() => COOKIES) }),
  computed,
});

beforeEach(() => {
  sharingOn.value = true;
  federationOn.value = false;
  analyticsOn.value = false;
});

function mount(): HTMLElement {
  const { container } = render(PrivacyPolicyPage, {
    global: { components: { NuxtLink } },
  });
  return container as HTMLElement;
}

/** Whitespace collapsed the way a reader sees it, so a wrapped sentence matches. */
function readable(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function headings(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h2')).map((h2) => readable(h2));
}

describe('/privacy sharing purposes', () => {
  it('renders every registered purpose, using the registry sentences verbatim', async () => {
    const container = mount();
    const text = readable(container);
    expect(PROCESSING_PURPOSES.length).toBe(3); // guard: an empty registry asserts nothing

    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(text).toContain(spec.label);
      // Byte for byte. A paraphrase here would drift from the sentence the
      // member reads beside the switch, which is the defect this closes.
      expect(text).toContain(spec.offSummary.replace(/\s+/g, ' '));
      expect(text).toContain(spec.revocationEffect.replace(/\s+/g, ' '));
    }
  });

  it('renders the on-state sentence only for purposes whose copy needs no operator value', async () => {
    const container = mount();
    const text = readable(container);
    for (const id of PROCESSING_PURPOSES) {
      const template = PROCESSING_PURPOSE_SPECS[id].onSummaryTemplate;
      if (/\{[a-zA-Z]+\}/.test(template)) continue;
      expect(text).toContain(template.replace(/\s+/g, ' '));
    }
    // And at least one purpose exercises each branch, so neither is untested.
    const withToken = PROCESSING_PURPOSES.filter((id) =>
      /\{[a-zA-Z]+\}/.test(PROCESSING_PURPOSE_SPECS[id].onSummaryTemplate),
    );
    expect(withToken.length).toBeGreaterThan(0);
    expect(withToken.length).toBeLessThan(PROCESSING_PURPOSES.length);
  });

  it('never prints an unsubstituted copy token', async () => {
    // `onSummaryTemplate` names the operator's k-anonymity floor. Printing the
    // raw `{minBucket}` would be gibberish; printing a guessed 5 on an instance
    // running 25 would understate a member's protection by five times. Neither
    // reaches the page.
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: an empty render prints no token either
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('points at the surface that carries the resolved wording and the named parties', async () => {
    const container = mount();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
      .map((a) => a.getAttribute('href'))
      .filter((href) => href === '/settings/privacy');
    expect(links.length).toBeGreaterThan(0);
  });

  it('states that no choice shares an email address or adds a contact channel', async () => {
    const container = mount();
    expect(readable(container)).toContain(
      'None of these choices shares your email address, and none of them creates a way for anyone to contact you other than the messages any account on this site can already send you.',
    );
  });

  it('renders no sharing section at all when dataSharingConsents is off', async () => {
    sharingOn.value = false;
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: the rest of the policy still rendered
    for (const id of PROCESSING_PURPOSES) {
      expect(text).not.toContain(PROCESSING_PURPOSE_SPECS[id].label);
    }
    expect(text).not.toContain('Choices you make about your own profile');
  });
});

describe('/privacy section numbering stays derived', () => {
  it('numbers the sharing section in sequence and shifts everything after it', async () => {
    const withSharing = headings(mount());
    sharingOn.value = false;
    const withoutSharing = headings(mount());

    expect(withSharing).toHaveLength(withoutSharing.length + 1);
    // Every heading is "N. Title", numbered 1..n with no gap and no repeat, in
    // both configurations. A hand-written number would break one of them.
    for (const list of [withSharing, withoutSharing]) {
      expect(list.length).toBeGreaterThan(5); // guard: zero headings numbers nothing
      list.forEach((heading, i) => {
        expect(heading.startsWith(`${i + 1}. `)).toBe(true);
      });
    }

    const sharing = withSharing.find((h2) => h2.includes('Choices you make about your own profile'));
    expect(sharing).toBeDefined();
    // It sits after the cookie disclosures, where the other consent-based
    // sections live, rather than being appended at the end.
    const sharingIndex = withSharing.findIndex((h2) => h2 === sharing);
    const cookieIndex = withSharing.findIndex((h2) => h2.includes('Cookies'));
    expect(cookieIndex).toBeGreaterThanOrEqual(0);
    expect(sharingIndex).toBeGreaterThan(cookieIndex);
  });

  it('keeps the numbering right with federation on as well', async () => {
    federationOn.value = true;
    const list = headings(mount());
    list.forEach((heading, i) => {
      expect(heading.startsWith(`${i + 1}. `)).toBe(true);
    });
    expect(list.some((h2) => h2.includes('Federation'))).toBe(true);
  });
});

describe('/privacy copy rules', () => {
  it('carries no em dash and no exclamation mark', async () => {
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: an empty render bans nothing
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/!/);
  });

  it('has no axe violations', async () => {
    const container = mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
