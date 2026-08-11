/**
 * Regression test for a consent bug in the `contestSignup`-off fallback card
 * (found session 253).
 *
 * That branch rendered a button labelled "Follow this contest" which emitted
 * `register` with NO payload. The page defaults `tier = payload?.tier ?? 'full'`,
 * so pressing Follow created a FULL registration: the viewer became a counted
 * participant without ever seeing the contest's required fields or accepting its
 * agreements — precisely the gate `contestEntryRequiresRegistration` exists to
 * enforce — and was then told "You're following this contest".
 *
 * The emit type is now required rather than optional, so this cannot silently
 * come back; this test covers the runtime half.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h, computed } from 'vue';
import ContestSidebar from '../ContestSidebar.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});
// The fallback only renders with the two-tier signup card switched OFF.
const ContestSignup = defineComponent({ name: 'ContestSignup', setup: () => () => h('div') });

Object.assign(globalThis, {
  useFeatures: () => ({ contestSignup: computed(() => false) }),
  formatLocalDate: (s: string) => String(s),
  formatLocalDateRange: (a: string, b: string) => `${a} to ${b}`,
  showsRegisteredCount: (c: { followerCount?: number }) => (c?.followerCount ?? 0) > 0,
  normalizeStages: () => [],
  currentStageId: () => null,
  STAGE_KIND_ICON: {},
});

function mount(contest: Record<string, unknown> = {}) {
  return render(ContestSidebar, {
    props: {
      contest: { slug: 'resilient', status: 'active', followerCount: 3, ...contest },
      isAuthenticated: true,
      registered: false,
      tier: null,
    } as never,
    global: { components: { NuxtLink, ContestSignup } },
  });
}

describe('ContestSidebar — contestSignup-off fallback', () => {
  it('Follow emits the reminders tier, NOT a silent full registration', async () => {
    const { container, emitted } = mount();
    const follow = [...container.querySelectorAll('button')]
      .find((b) => /Follow this contest/i.test(b.textContent ?? ''));
    expect(follow, 'the fallback renders a Follow button').toBeTruthy();

    follow!.click();
    await Promise.resolve();

    const events = emitted().register as unknown[][] | undefined;
    expect(events, 'clicking Follow emits register').toBeTruthy();
    // The bug was an EMPTY emit here, which the page read as tier 'full'.
    expect(events![0][0]).toEqual({ tier: 'reminders' });
  });
});
