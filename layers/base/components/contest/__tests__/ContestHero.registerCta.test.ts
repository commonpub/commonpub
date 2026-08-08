/**
 * Component tests for the contest hero's PRIMARY call-to-action (session 250).
 *
 * Locks two coupled rules:
 *  1. The register CTA lives at the TOP of the contest page, beside Submit Entry —
 *     not only in the sidebar signup card, which is below the fold on a long
 *     contest description.
 *  2. Registration precedes entry. With `entryRequiresRegistration` on (the
 *     default, mirroring the server gate on POST /entries), the hero offers
 *     "Register" until the viewer is a `full` registrant and "Submit Entry"
 *     after — so nobody picks a project only to be 403'd at the end. Following
 *     the contest (`reminders`) is not registering.
 *
 * The page uses Nuxt auto-imports (formatLocalDate, markdownToExcerpt, the
 * contestStages utils, imageFramingStyle) — stub them on globalThis.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import ContestHero from '../ContestHero.vue';
import type { Serialized, ContestDetail } from '@commonpub/server';
import { normalizeStages, currentStageId, currentStage, currentStageEnd, STAGE_KIND_ICON } from '../../../utils/contestStages';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

Object.assign(globalThis, {
  formatLocalDate: (s: string) => String(s),
  formatLocalDateRange: (a: string, b: string) => `${a} to ${b}`,
  markdownToExcerpt: (s?: string | null) => s ?? '',
  imageFramingStyle: () => undefined,
  isWholeImage: () => false,
  contestTransitionsFrom: () => [],
  contestStatusAction: (t: string) => ({ icon: 'fa-play', label: t }),
  normalizeStages,
  currentStageId,
  currentStage,
  currentStageEnd,
  STAGE_KIND_ICON,
});

// Only the fields the hero reads; cast because the DTO carries ~30 more.
const CONTEST = {
  slug: 'resilient',
  title: 'Resilient Cup',
  status: 'active',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-12-01T00:00:00Z',
  entryCount: 3,
  followerCount: 12,
  stages: null,
  currentStageId: null,
} as unknown as Serialized<ContestDetail>;

function mount(over: Record<string, unknown> = {}) {
  return render(ContestHero, {
    props: {
      contest: { ...CONTEST, ...(over.contest as object ?? {}) } as Serialized<ContestDetail>,
      isAdmin: false,
      isAuthenticated: true,
      transitioning: false,
      entryRequiresRegistration: true,
      registrationTier: null,
      ...over,
    },
    global: { stubs: { NuxtLink } },
  });
}

const labels = (c: Element) => [...c.querySelectorAll('.cpub-hero-cta a, .cpub-hero-cta button')].map((el) => el.textContent?.trim() ?? '');

describe('ContestHero — register CTA at the top of the page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers Register (not Submit Entry) to an authenticated non-registrant', () => {
    const { container } = mount();
    const text = labels(container).join('|');
    expect(text).toContain('Register for this contest');
    expect(text).not.toContain('Submit Entry');
  });

  it('offers Submit Entry (not Register) once the viewer is a full registrant', () => {
    const { container } = mount({ registrationTier: 'full' });
    const text = labels(container).join('|');
    expect(text).toContain('Submit Entry');
    expect(text).not.toContain('Register for this contest');
  });

  it('treats a reminders-tier follower as NOT registered (they accepted nothing)', () => {
    const { container } = mount({ registrationTier: 'reminders' });
    const text = labels(container).join('|');
    expect(text).toContain('Register for the contest');
    expect(text).not.toContain('Submit Entry');
  });

  it('sends an anonymous visitor to sign-in, returning to this contest', () => {
    const { container } = mount({ isAuthenticated: false });
    const link = container.querySelector('.cpub-hero-cta a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/auth/login?redirect=/contests/resilient');
    expect(link.textContent).toContain('Log in to register');
  });

  it('emits register when the CTA is clicked, and disables it while in flight', async () => {
    const { container, emitted } = mount();
    const btn = container.querySelector('.cpub-hero-cta button') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    expect(emitted().register).toBeTruthy();

    const busy = mount({ registering: true });
    const busyBtn = busy.container.querySelector('.cpub-hero-cta button') as HTMLButtonElement;
    expect(busyBtn.disabled).toBe(true);
    expect(busyBtn.textContent).toContain('Registering');
  });

  it('shows Register on an UPCOMING contest but no Submit Entry (entries not open)', () => {
    const { container } = mount({ contest: { status: 'upcoming' } });
    const text = labels(container).join('|');
    expect(text).toContain('Register for this contest');
    expect(text).not.toContain('Submit Entry');
  });

  it('drops both CTAs once registration closes (judging / completed)', () => {
    for (const status of ['judging', 'completed', 'cancelled']) {
      const { container } = mount({ contest: { status }, registrationTier: null });
      const text = labels(container).join('|');
      expect(text, status).not.toContain('Register');
      expect(text, status).not.toContain('Submit Entry');
      expect(text, status).toContain('Share');
    }
  });

  it('flag OFF (legacy): an unregistered viewer may still submit directly', () => {
    const { container } = mount({ entryRequiresRegistration: false });
    const text = labels(container).join('|');
    expect(text).toContain('Submit Entry');
    // The register CTA stays available — it is still the way to be counted.
    expect(text).toContain('Register for this contest');
  });
});
