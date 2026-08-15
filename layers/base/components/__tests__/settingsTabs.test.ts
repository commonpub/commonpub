/**
 * Tab registration for `/settings` (plan 6.8 and 8.1).
 *
 * A flag that is off must not leave a link to a page that renders only a "not
 * enabled" notice.
 *
 * Profile Details is gone from this nav: it was a second editor for the same
 * person and is now a tab inside Profile (plan R3.1 D7). The `persona` flag
 * still gates it, one level down, which is `settingsProfileTabs.test.ts`'s
 * subject. What this file now guards is that no route back to the duplicate
 * survives here.
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import SettingsPage from '../../pages/settings.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const NuxtPage = defineComponent({ name: 'NuxtPage', setup: () => () => h('div') });

const persona = ref(false);
const dataSharingConsents = ref(false);
const referralLinks = ref(false);

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useFeatures: () => ({ persona, dataSharingConsents, referralLinks }),
});

beforeEach(() => {
  persona.value = false;
  dataSharingConsents.value = false;
  referralLinks.value = false;
});

function mount() {
  return render(SettingsPage, { global: { stubs: { NuxtLink, NuxtPage } } });
}

function hrefs(container: Element): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
}

describe('settings tabs', () => {
  it('still shows every pre-existing tab', () => {
    const { container } = mount();
    const links = hrefs(container);
    // Guard: if the nav failed to render at all, the absence assertions below
    // would pass for the wrong reason.
    expect(links).toContain('/settings/profile');
    expect(links).toContain('/settings/account');
    expect(links).toContain('/settings/notifications');
    expect(links).toContain('/settings/appearance');
  });

  it('never links a second Profile entry, with `persona` on or off', () => {
    // The merge is not finished while two editors exist. Turning `persona` on
    // must add a TAB inside Profile, not a sibling of it.
    for (const on of [false, true]) {
      persona.value = on;
      const links = hrefs(mount().container);
      expect(links).not.toContain('/settings/persona');
      expect(links.filter((l) => l.startsWith('/settings/profile'))).toEqual(['/settings/profile']);
    }
  });

  it('shows the privacy tab with every sharing flag OFF', () => {
    // It used to be gated on `dataSharingConsents`, which was right while
    // sharing consents were the only thing on that page. They are not: profile
    // visibility, the subject-rights links and the statistics objection all
    // live there, and the objection is a member's control over processing that
    // runs whether or not they agree. Gating the only route to it behind a
    // sharing flag would make an Art. 21 right reachable only by typing a URL.
    dataSharingConsents.value = false;
    persona.value = false;
    const links = hrefs(mount().container);
    expect(links).toContain('/settings/privacy');
    expect(links).not.toContain('/settings/persona');
  });

  it('still shows the privacy tab when `dataSharingConsents` is on', () => {
    dataSharingConsents.value = true;
    const { container } = mount();
    const links = hrefs(container);
    expect(links).toContain('/settings/privacy');
    // The two flags are independent: collecting is not disclosing.
    expect(links).not.toContain('/settings/persona');
  });

  it('orders the privacy tab after Account', () => {
    // RELATIVE order, not adjacency. Index arithmetic turns red when any
    // unrelated settings tab is inserted or the nav is reordered for a design
    // reason, and catches no defect the tests above miss.
    dataSharingConsents.value = true;
    const { container } = mount();
    const links = hrefs(container);
    expect(links.indexOf('/settings/privacy')).toBeGreaterThan(links.indexOf('/settings/account'));
  });

  it('carries no em dash in its labels', () => {
    persona.value = true;
    dataSharingConsents.value = true;
    const { container } = mount();
    const text = container.textContent ?? '';
    expect(text.length).toBeGreaterThan(40);
    expect(text).not.toMatch(/—/);
  });
});
