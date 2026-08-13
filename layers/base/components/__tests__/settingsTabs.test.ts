/**
 * Tab registration for `/settings` (plan 6.8 and 8.1).
 *
 * Both new tabs are flag gated. A flag that is off must not leave a link to a
 * page that renders only a "not enabled" notice, and the persona tab must not
 * appear on an instance that has never turned the feature on, which is every
 * instance by default.
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

  it('hides both new tabs while their flags are off (the default)', () => {
    const { container } = mount();
    const links = hrefs(container);
    expect(links).not.toContain('/settings/persona');
    expect(links).not.toContain('/settings/privacy');
  });

  it('shows the persona tab only when `persona` is on', async () => {
    persona.value = true;
    const { container } = mount();
    const links = hrefs(container);
    expect(links).toContain('/settings/persona');
    // The two flags are independent: collecting is not disclosing.
    expect(links).not.toContain('/settings/privacy');
  });

  it('shows the privacy tab only when `dataSharingConsents` is on', () => {
    dataSharingConsents.value = true;
    const { container } = mount();
    const links = hrefs(container);
    expect(links).toContain('/settings/privacy');
    expect(links).not.toContain('/settings/persona');
  });

  it('orders the persona tab after Profile and the privacy tab after Account', () => {
    // RELATIVE order, not adjacency. Index arithmetic turns red when any
    // unrelated settings tab is inserted or the nav is reordered for a design
    // reason, and catches no defect the flag-gating tests above miss.
    persona.value = true;
    dataSharingConsents.value = true;
    const { container } = mount();
    const links = hrefs(container);
    expect(links.indexOf('/settings/persona')).toBeGreaterThan(links.indexOf('/settings/profile'));
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
