/**
 * Component tests for the narrow-viewport contest action bar (session 253).
 *
 * The state matrix IS the contract. This bar is the only call to action a mobile
 * visitor sees for most of a ~10,000px page, so every cell that renders the
 * wrong control is a dead end, and every cell that renders a control the viewer
 * cannot use is worse than rendering nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import axe from 'axe-core';
import ContestActionBar from '../ContestActionBar.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

const CONTEST = { slug: 'resilient', title: 'Resilient Cup', status: 'active' };

type Props = Record<string, unknown>;
function mount(props: Props = {}) {
  // The bar reads a handful of fields; casting keeps the fixtures readable
  // instead of restating all 36 of ContestDetail's properties per case.
  return render(ContestActionBar, {
    props: { ...props, contest: { ...CONTEST, ...(props.contest as object ?? {}) } } as never,
    global: { components: { NuxtLink } },
  });
}

/** Visible control labels, in order. */
function labels(container: Element): string {
  return [...container.querySelectorAll('.cpub-contest-actions a, .cpub-contest-actions button, .cpub-contest-actions-state')]
    .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('|');
}

describe('ContestActionBar — who sees what', () => {
  it('offers an anonymous visitor Register, pointed at the FORM behind login', () => {
    const { container } = mount({ isAuthenticated: false });
    expect(labels(container)).toContain('Register');
    const link = container.querySelector('.cpub-contest-actions-main') as HTMLAnchorElement;
    // Not back to the contest page still unregistered — into the form.
    expect(link.getAttribute('href')).toBe('/auth/login?redirect=/contests/resilient/register');
  });

  it('offers an authenticated non-registrant both tiers: Register and Follow', () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: null });
    const l = labels(container);
    expect(l).toContain('Register');
    // Follow was previously authenticated-only AND buried two screens down.
    expect(l).toContain('Follow');
  });

  it('shows a follower their state and still offers the upgrade to Register', () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: 'reminders' });
    const l = labels(container);
    expect(l).toContain('Register');
    expect(l).toContain('Following');
    expect(l).not.toContain('Follow|');
  });

  it('moves a full registrant on to Submit entry while the contest is open', () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: 'full' });
    const l = labels(container);
    expect(l).toContain('Submit entry');
    expect(l).not.toContain('Register');
  });

  it('does not offer Submit before submissions open', () => {
    const { container } = mount({ contest: { status: 'upcoming' }, isAuthenticated: true, registrationTier: 'full' });
    const l = labels(container);
    expect(l).not.toContain('Submit entry');
    expect(l).toContain('Registered');
  });

  it('never offers an organizer an entry into their own contest', () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: 'full', canManage: true });
    const l = labels(container);
    expect(l).not.toContain('Submit entry');
    expect(l).toContain('Edit');
  });

  it('gives a scoring judge their own action while judging', () => {
    const { container } = mount({ contest: { status: 'judging' }, isAuthenticated: true, canJudge: true });
    expect(labels(container)).toContain('Judge entries');
  });

  it('degrades a finished contest to the outcome, never a dead Register', () => {
    // Completed is the PERMANENT state of every contest and the one that keeps
    // accruing traffic, so this is the cell that renders most often over time.
    const { container } = mount({ contest: { status: 'completed' }, isAuthenticated: false });
    const l = labels(container);
    expect(l).toContain('View results');
    expect(l).not.toContain('Register');
  });

  it('offers nothing but sharing on a cancelled contest', () => {
    const { container } = mount({ contest: { status: 'cancelled' }, isAuthenticated: true });
    const l = labels(container);
    expect(l).not.toContain('Register');
    expect(l).not.toContain('View results');
  });

  it('does not render at all for a draft, or with no contest', () => {
    expect(mount({ contest: { status: 'draft' } }).container.querySelector('.cpub-contest-actions')).toBeNull();
    expect(
      render(ContestActionBar, { props: { contest: null }, global: { components: { NuxtLink } } })
        .container.querySelector('.cpub-contest-actions'),
    ).toBeNull();
  });

  it('renders the ANONYMOUS state when the tier is unknown, which is what SSR sees', () => {
    // registrationTier is client-only by design, so the server and the first
    // client render must both produce the majority-visitor state.
    const { container } = mount({ isAuthenticated: false, registrationTier: undefined });
    expect(labels(container)).toContain('Register');
  });
});

describe('ContestActionBar — behaviour and a11y', () => {
  it('emits rather than navigating for the in-page actions', async () => {
    const { container, emitted } = mount({ isAuthenticated: true, registrationTier: null });
    const buttons = [...container.querySelectorAll('button')];
    buttons.find((b) => /Register/.test(b.textContent ?? ''))!.click();
    buttons.find((b) => /Follow/.test(b.textContent ?? ''))!.click();
    container.querySelector<HTMLButtonElement>('.cpub-contest-actions-share')!.click();
    await Promise.resolve();
    expect(emitted()).toHaveProperty('register');
    expect(emitted()).toHaveProperty('follow');
    expect(emitted()).toHaveProperty('copy-link');
  });

  it('disables the primary while a registration is in flight', () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: null, registering: true });
    const main = container.querySelector('.cpub-contest-actions-main') as HTMLButtonElement;
    expect(main.disabled).toBe(true);
    expect(main.textContent).toContain('Registering');
  });

  it('names the icon-only share control for assistive tech', () => {
    const { container } = mount({ isAuthenticated: false });
    expect(container.querySelector('.cpub-contest-actions-share')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('is a labelled group, not an unnamed pile of buttons', () => {
    const { container } = mount({ isAuthenticated: false });
    const bar = container.querySelector('.cpub-contest-actions')!;
    expect(bar.getAttribute('role')).toBe('group');
    expect(bar.getAttribute('aria-label')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = mount({ isAuthenticated: true, registrationTier: null });
    const results = await axe.run(container as HTMLElement);
    expect(results.violations).toEqual([]);
  });

  it('does not reuse a class the e2e suite asserts in strict mode', () => {
    // The first namespace attempt (cpub-cbar) collided with CpubCriteriaBar.
    const { container } = mount({ isAuthenticated: false });
    const html = container.innerHTML;
    for (const taken of ['cpub-hero-cta', 'cpub-stage-chip', 'cpub-tl-now', 'cpub-signup', 'cpub-entries-cta', 'cpub-cbar"']) {
      expect(html, `must not reuse ${taken}`).not.toContain(taken);
    }
  });
});
