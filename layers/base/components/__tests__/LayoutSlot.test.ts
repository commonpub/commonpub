/**
 * Tests for <LayoutSlot> — the zone renderer that <pages/index.vue> and
 * <pages/[...customPath].vue> use to render layout-engine output.
 *
 * Phase 3a.1 adds an `editable?: boolean` prop. When true, the row + section
 * wrappers get `--editable` modifier classes that paint a dashed hover
 * outline + a small type-label badge. NO event handlers / selection state /
 * keyboard model in 3a.1 — those arrive in 3a.3 + 3d. Public render paths
 * (which never pass the flag) MUST be byte-pattern unchanged.
 *
 * The tests below feed a static layout via `previewOverride` to bypass
 * the network — useLayout is still called, so we stub it to return
 * null + pending=false (the previewOverride path takes over the render).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import { ref } from 'vue';
import LayoutSlot from '../LayoutSlot.vue';
import type { LayoutPayload } from '../../composables/useLayout';

/* ---- Composable stubs ---- */

function setupComposables(featureFlags: Record<string, boolean> = {}): void {
  const g = globalThis as Record<string, unknown>;
  g.useLayout = () => ({
    layout: ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: () => Promise.resolve(),
  });
  g.useFeatures = () => ({
    features: ref({ admin: true, layoutEngine: true, ...featureFlags }),
  });
  g.useAuth = () => ({
    isAuthenticated: ref(false),
    user: ref(null),
  });
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.useLayout;
  delete g.useFeatures;
  delete g.useAuth;
});

/* ---- Fixtures ---- */

/** Minimal layout payload — one row in `main` zone, one `divider` section.
 *  `divider` is registered in layers/base/sections/builtin/divider.ts and
 *  is the simplest section to render in tests. */
function makeLayout(): LayoutPayload {
  return {
    state: 'published',
    pageMeta: null,
    zones: [
      {
        zone: 'main',
        rows: [
          {
            id: 'row-1',
            order: 0,
            config: { gap: 'md' },
            sections: [
              {
                id: 'sec-1',
                order: 0,
                type: 'divider',
                config: {},
                colSpan: 12,
                responsive: null,
                enabled: true,
                visibility: null,
                schemaVersion: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

function mount(props: { editable?: boolean }) {
  return render(LayoutSlot, {
    props: {
      route: '/test',
      zone: 'main',
      previewOverride: makeLayout(),
      ...props,
    },
  });
}

/* ---- Tests ---- */

describe('LayoutSlot — render path (regression-guard)', () => {
  it('renders the row + section wrapper for the given zone', () => {
    setupComposables();
    const { container } = mount({});
    expect(container.querySelector('.cpub-layout-row')).not.toBeNull();
    expect(container.querySelector('.cpub-layout-section')).not.toBeNull();
    expect(container.querySelector('[data-section-id="sec-1"]')).not.toBeNull();
    expect(container.querySelector('[data-section-type="divider"]')).not.toBeNull();
  });
});

describe('LayoutSlot — :editable prop', () => {
  it('default (editable=false) does NOT add --editable classes (public-mode pristine)', () => {
    // This is the load-bearing test: the public homepage path must be
    // byte-pattern unchanged. Any leak of `--editable` into commonpub.io's
    // public HTML is a regression.
    setupComposables();
    const { container } = mount({});
    expect(container.querySelector('.cpub-layout-row--editable')).toBeNull();
    expect(container.querySelector('.cpub-layout-section--editable')).toBeNull();
  });

  it('editable=true applies --editable classes to row + section wrappers', () => {
    setupComposables();
    const { container } = mount({ editable: true });
    expect(container.querySelector('.cpub-layout-row--editable')).not.toBeNull();
    expect(container.querySelector('.cpub-layout-section--editable')).not.toBeNull();
  });

  it('editable=true preserves data-section-id + data-section-type (no semantic drift)', () => {
    // Mode change must NOT alter data attributes that downstream tooling
    // (selectors, accessibility scanners, future click handlers in 3a.3)
    // rely on to identify sections.
    setupComposables();
    const { container } = mount({ editable: true });
    const section = container.querySelector('.cpub-layout-section--editable');
    expect(section?.getAttribute('data-section-id')).toBe('sec-1');
    expect(section?.getAttribute('data-section-type')).toBe('divider');
  });

  it('editable=true does NOT add tabindex / role / click handlers (deferred to 3a.3)', () => {
    // Phase 3a.1 is visual-affordance only. Shipping tabindex/role here
    // without a selection model behind them would mislead screen readers
    // ("a button that does nothing"). 3a.3 introduces both together.
    setupComposables();
    const { container } = mount({ editable: true });
    const section = container.querySelector('.cpub-layout-section--editable');
    expect(section?.getAttribute('tabindex')).toBeNull();
    expect(section?.getAttribute('role')).toBeNull();
    const row = container.querySelector('.cpub-layout-row--editable');
    expect(row?.getAttribute('tabindex')).toBeNull();
    expect(row?.getAttribute('role')).toBeNull();
  });
});
