/**
 * Component test for `/privacy`, the policy page.
 *
 * The audit finding this closes: the cookie banner and `/cookies` both link
 * across to Privacy settings, `/settings/privacy` renders every sentence of
 * consent copy from the purpose registry, and this page (the one a person can
 * read before signing up, and the one Art. 13 is actually about) described the
 * sharing purposes nowhere at all.
 *
 * The assertion that gives each section its value is the one comparing the
 * rendered text to `PROCESSING_PURPOSE_SPECS` and `PERSONA_STATISTICS` character
 * for character. A paraphrase would pass a "does it mention recruiters" test
 * forever while drifting from the sentence members actually act on, which is the
 * whole reason the registry exists.
 *
 * Three properties are the corrected model and are pinned below:
 *   - statistics are described as legitimate interest with an OBJECTION, never
 *     as a consent choice, and the purpose that used to say otherwise is gone;
 *   - persona answers are stated to be private unless the operator shows them;
 *   - with the persona and sharing flags off, neither subject appears at all.
 *
 * Lives under components/__tests__ (bracket-free) for the same packaging reason
 * as `privacySettingsPage.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import { defineComponent, h, ref, computed } from 'vue';
import {
  PERSONA_STATISTICS,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
} from '@commonpub/persona';
import PrivacyPolicyPage from '../../pages/privacy.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const sharingOn = ref(true);
const federationOn = ref(false);
const analyticsOn = ref(false);
const personaOn = ref(true);
const personaAnalyticsOn = ref(true);

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
    persona: personaOn,
    personaAnalytics: personaAnalyticsOn,
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
  personaOn.value = true;
  personaAnalyticsOn.value = true;
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
    // Exactly the two named-third-party purposes. `profile_analytics` was
    // removed rather than deprecated, so a third entry here means somebody put
    // a non-disclosure back into a registry of disclosures.
    expect(PROCESSING_PURPOSES.length).toBe(2); // guard: an empty registry asserts nothing
    expect([...PROCESSING_PURPOSES]).toEqual(['recruiter_visibility', 'sponsor_sharing']);

    for (const id of PROCESSING_PURPOSES) {
      const spec = PROCESSING_PURPOSE_SPECS[id];
      expect(text).toContain(spec.label);
      // Byte for byte. A paraphrase here would drift from the sentence the
      // member reads beside the switch, which is the defect this closes.
      expect(text).toContain(spec.offSummary.replace(/\s+/g, ' '));
      expect(text).toContain(spec.revocationEffect.replace(/\s+/g, ' '));
    }
  });

  it('renders the on-state sentence for every purpose whose copy needs no operator value', async () => {
    const container = mount();
    const text = readable(container);
    // Neither surviving purpose names a k-anonymity floor, because both
    // disclose one named member to one named recipient and a floor over a group
    // has nothing to say about that. So both sentences render in full today.
    const withToken = PROCESSING_PURPOSES.filter((id) =>
      /\{[a-zA-Z]+\}/.test(PROCESSING_PURPOSE_SPECS[id].onSummaryTemplate),
    );
    expect(withToken).toEqual([]);
    for (const id of PROCESSING_PURPOSES) {
      const template = PROCESSING_PURPOSE_SPECS[id].onSummaryTemplate;
      expect(text).toContain(template.replace(/\s+/g, ' '));
    }
    // The token guard in the page is deliberately kept even though no purpose
    // exercises it now: it is this surface's half of the invariant that a
    // template is never printed raw, and a purpose added later must not be able
    // to bypass it. The invariant itself is asserted by the next test, which is
    // live because `PERSONA_STATISTICS.summaryTemplate` does carry a token.
  });

  it('never prints an unsubstituted copy token', async () => {
    // `PERSONA_STATISTICS.summaryTemplate` names the operator's k-anonymity
    // floor. Printing the raw `{minBucket}` would be gibberish; printing a
    // guessed 5 on an instance running 25 would understate a member's
    // protection by five times. Neither reaches the page.
    expect(PERSONA_STATISTICS.summaryTemplate).toMatch(/\{minBucket\}/); // guard: a token-free registry asserts nothing
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
    expect(text).not.toContain('Choices about people outside this site');
  });
});

/**
 * The correction: counting is not a consent question, and the policy has to say
 * which basis it runs on and what the member can do about it.
 */
describe('/privacy community statistics', () => {
  it('describes statistics as legitimate interest with an objection, never as consent', async () => {
    const container = mount();
    const text = readable(container);
    expect(text).toContain('Community statistics');
    expect(text).toContain(PERSONA_STATISTICS.basisNote.replace(/\s+/g, ' '));
    expect(text).toContain(PERSONA_STATISTICS.objectEffect.replace(/\s+/g, ' '));
    expect(text).toContain('legitimate interest (Art. 6(1)(f)), not your consent');
    expect(text).toContain('the right to object (Art. 21)');
    // The control is named by its real label, so the policy and the switch
    // cannot describe different acts.
    expect(text).toContain(PERSONA_STATISTICS.objectLabel);
    // The default is stated, because it is the opposite of every other control
    // described on this page.
    expect(text).toContain('You are counted until you use it');
  });

  it('carries no trace of the deleted consent purpose', async () => {
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: an empty render carries no trace either
    expect(text).not.toContain('profile_analytics');
    expect(text).not.toContain('Count my answers');
    // The sentence that made counting a consent question, in either direction.
    expect(text).not.toContain('nothing about you leaves this site');
  });

  it('renders no statistics section when personaAnalytics is off', async () => {
    personaAnalyticsOn.value = false;
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: the rest of the policy still rendered
    expect(text).not.toContain('Community statistics');
    expect(text).not.toContain(PERSONA_STATISTICS.basisNote.replace(/\s+/g, ' '));
  });
});

/**
 * The persona model itself: answers are private unless the operator opts a field
 * on to the profile, and the whole subject disappears when `persona` is off.
 */
describe('/privacy the questions this site asks', () => {
  it('says answers are private unless the operator shows them, and that admins can see them', async () => {
    const container = mount();
    const text = readable(container);
    expect(text).toContain('Your Profile, and the Questions We Ask');
    expect(text).toContain('Your profile is public because that is what a profile is');
    expect(text).toContain('not shown on your profile');
    expect(text).toContain('Nothing you answer is published by default');
    expect(text).toContain('Administrators of this site can see your answers');
  });

  it('says nothing about questions, statistics or sharing on an instance running none of it', async () => {
    // The makerspace case, and its mirror: an instance with persona off asks no
    // questions at all, so a section about answers would describe nothing.
    personaOn.value = false;
    personaAnalyticsOn.value = false;
    sharingOn.value = false;
    const container = mount();
    const text = readable(container);
    expect(text.length).toBeGreaterThan(500); // guard: the rest of the policy still rendered
    for (const banned of [
      'Your Profile, and the Questions We Ask',
      'Community statistics',
      'Choices about people outside this site',
      'recruiter',
      'sponsor',
      'group totals',
      'counted',
    ]) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    // The generic Art. 21 bullet survives, because the right exists whatever
    // this instance runs. What must not survive is the STATISTICS-specific
    // version of it, which names a control that is not there.
    expect(text).toContain('Restriction and objection: contact the instance administrator');
  });

  it('says nothing about statistics or sharing when only persona is on', async () => {
    // `persona` alone: questions, private answers, and no sharing language.
    personaAnalyticsOn.value = false;
    sharingOn.value = false;
    const container = mount();
    const text = readable(container);
    expect(text).toContain('Your Profile, and the Questions We Ask');
    for (const banned of [
      'Community statistics',
      'group totals',
      'counted',
      'recruiter',
      'sponsor',
      'shared with',
    ]) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
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

    const sharing = withSharing.find((h2) => h2.includes('Choices about people outside this site'));
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
