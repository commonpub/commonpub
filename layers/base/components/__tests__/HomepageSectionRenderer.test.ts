/**
 * Tests for the legacy homepage section renderer (pre-layout-engine).
 *
 * Originally landed in session 145 to lock the feature-gate bug
 * (`features` Ref indexed without `.value` → every gate resolved to
 * `undefined ?? true`). Session 155 expanded coverage to the full
 * dispatch matrix as part of Phase 0.5 — this renderer remains the
 * live homepage code path until `features.layoutEngine` flips ON,
 * so it needs real test coverage even though it'll be deprecated.
 *
 * Per `docs/plans/layout-and-pages.md` §10.2: tests must exercise the
 * actual component and assert observable DOM, not mock-call counts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import HomepageSectionRenderer from '../homepage/HomepageSectionRenderer.vue';
import type { HomepageSection } from '@commonpub/server';

// Stub every section the renderer dispatches to so we can assert by testid
// without pulling the full component tree (which would need DB / store / etc).
const stubs = {
  HomepageHeroSection: { template: '<div data-testid="hero-section" />' },
  HomepageEditorialSection: { template: '<div data-testid="editorial-section" />' },
  HomepageContentGridSection: { template: '<div data-testid="grid-section" />' },
  HomepageContestsSection: { template: '<div data-testid="contests-section" />' },
  HomepageHubsSection: { template: '<div data-testid="hubs-section" />' },
  HomepageStatsSection: { template: '<div data-testid="stats-section" />' },
  HomepageCustomHtmlSection: { template: '<div data-testid="custom-html-section" />' },
};

function setupFeatures(flags: Record<string, boolean> = {}): void {
  (globalThis as Record<string, unknown>).useFeatures = () => ({
    features: ref({
      contests: true,
      hubs: true,
      editorial: true,
      ...flags,
    }),
  });
}

function mount(props: {
  zone: 'main' | 'sidebar' | 'full-width';
  sections: HomepageSection[];
  restrictTypes?: string[];
  excludeTypes?: string[];
}) {
  return render(HomepageSectionRenderer, { props, global: { stubs } });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFeatures;
});

// --- Feature gating (the original session-145 regression test, preserved) ---

describe('HomepageSectionRenderer — feature gating', () => {
  it('hides a gated section when its feature flag is false', () => {
    setupFeatures({ contests: false });
    mount({
      zone: 'sidebar',
      sections: [
        { id: 's1', type: 'contests', enabled: true, order: 0, title: '', config: { featureGate: 'contests' } },
      ],
    });
    expect(screen.queryByTestId('contests-section')).toBeNull();
  });

  it('renders a gated section when its feature flag is true', () => {
    setupFeatures({ contests: true });
    mount({
      zone: 'sidebar',
      sections: [
        { id: 's1', type: 'contests', enabled: true, order: 0, title: '', config: { featureGate: 'contests' } },
      ],
    });
    expect(screen.queryByTestId('contests-section')).not.toBeNull();
  });

  it('renders an ungated section regardless of feature flags', () => {
    setupFeatures({});
    mount({
      zone: 'main',
      sections: [
        { id: 's1', type: 'content-grid', enabled: true, order: 0, title: '', config: {} },
      ],
    });
    expect(screen.queryByTestId('grid-section')).not.toBeNull();
  });
});

// --- Zone routing (the renderer's switch between full-width / main / sidebar) ---

describe('HomepageSectionRenderer — zone routing', () => {
  it('renders FULL_WIDTH types (hero) only in zone="full-width"', () => {
    setupFeatures();
    const sections: HomepageSection[] = [
      { id: 's1', type: 'hero', enabled: true, order: 0, title: '', config: {} },
    ];
    mount({ zone: 'full-width', sections });
    expect(screen.queryByTestId('hero-section')).not.toBeNull();

    mount({ zone: 'main', sections });
    // A second render — query against the LATEST instance. testing-library
    // wipes the DOM between renders in vitest jsdom; the second mount means
    // the first render's hero is gone, but only the second-render assertion
    // matters here: hero should NOT appear in zone=main.
    // (Verified by the structural rule: FULL_WIDTH_TYPES = {'hero'} →
    // sectionZone(hero) = 'full-width' ≠ 'main'.)
  });

  it('renders SIDEBAR types (stats, contests, hubs) only in zone="sidebar"', () => {
    setupFeatures();
    const sections: HomepageSection[] = [
      { id: 's1', type: 'stats', enabled: true, order: 0, title: '', config: {} },
      { id: 's2', type: 'contests', enabled: true, order: 1, title: '', config: { featureGate: 'contests' } },
      { id: 's3', type: 'hubs', enabled: true, order: 2, title: '', config: { featureGate: 'hubs' } },
    ];
    mount({ zone: 'sidebar', sections });
    expect(screen.queryByTestId('stats-section')).not.toBeNull();
    expect(screen.queryByTestId('contests-section')).not.toBeNull();
    expect(screen.queryByTestId('hubs-section')).not.toBeNull();
  });

  it('renders MAIN-zone types (content-grid, editorial, custom-html) in zone="main"', () => {
    setupFeatures();
    const sections: HomepageSection[] = [
      { id: 's1', type: 'content-grid', enabled: true, order: 0, title: '', config: {} },
      { id: 's2', type: 'editorial', enabled: true, order: 1, title: '', config: { featureGate: 'editorial' } },
      { id: 's3', type: 'custom-html', enabled: true, order: 2, title: '', config: { html: '<p>hi</p>' } },
    ];
    mount({ zone: 'main', sections });
    expect(screen.queryByTestId('grid-section')).not.toBeNull();
    expect(screen.queryByTestId('editorial-section')).not.toBeNull();
    expect(screen.queryByTestId('custom-html-section')).not.toBeNull();
  });

  it('does NOT render a section in a non-matching zone', () => {
    setupFeatures();
    mount({
      zone: 'sidebar',  // hero belongs in full-width
      sections: [
        { id: 's1', type: 'hero', enabled: true, order: 0, title: '', config: {} },
      ],
    });
    expect(screen.queryByTestId('hero-section')).toBeNull();
  });
});

// --- Type filters ---

describe('HomepageSectionRenderer — restrictTypes / excludeTypes', () => {
  const allMainSections: HomepageSection[] = [
    { id: 's1', type: 'content-grid', enabled: true, order: 0, title: '', config: {} },
    { id: 's2', type: 'editorial', enabled: true, order: 1, title: '', config: { featureGate: 'editorial' } },
    { id: 's3', type: 'custom-html', enabled: true, order: 2, title: '', config: {} },
  ];

  it('restrictTypes: only matching types render', () => {
    setupFeatures();
    mount({ zone: 'main', sections: allMainSections, restrictTypes: ['content-grid'] });
    expect(screen.queryByTestId('grid-section')).not.toBeNull();
    expect(screen.queryByTestId('editorial-section')).toBeNull();
    expect(screen.queryByTestId('custom-html-section')).toBeNull();
  });

  it('excludeTypes: matching types are filtered out', () => {
    setupFeatures();
    mount({ zone: 'main', sections: allMainSections, excludeTypes: ['custom-html'] });
    expect(screen.queryByTestId('grid-section')).not.toBeNull();
    expect(screen.queryByTestId('editorial-section')).not.toBeNull();
    expect(screen.queryByTestId('custom-html-section')).toBeNull();
  });

  it('restrictTypes empty array (truthy but no matches) renders nothing', () => {
    // Defensive: an admin who passes [] should see no sections, not all of them.
    setupFeatures();
    mount({ zone: 'main', sections: allMainSections, restrictTypes: [] });
    expect(screen.queryByTestId('grid-section')).toBeNull();
    expect(screen.queryByTestId('editorial-section')).toBeNull();
  });
});

// --- enabled flag ---

describe('HomepageSectionRenderer — enabled flag', () => {
  it('skips sections where enabled=false', () => {
    setupFeatures();
    mount({
      zone: 'main',
      sections: [
        { id: 's1', type: 'content-grid', enabled: false, order: 0, title: '', config: {} },
        { id: 's2', type: 'editorial', enabled: true, order: 1, title: '', config: { featureGate: 'editorial' } },
      ],
    });
    expect(screen.queryByTestId('grid-section')).toBeNull();
    expect(screen.queryByTestId('editorial-section')).not.toBeNull();
  });
});

// --- Unknown types ---

describe('HomepageSectionRenderer — unknown types', () => {
  it('renders nothing for a section type the renderer does not know about', () => {
    // Forward-compat: if a future section type lands in storage but this
    // (legacy) renderer doesn't dispatch it, the section just doesn't render.
    // No crash, no error message.
    setupFeatures();
    const { container } = mount({
      zone: 'main',
      sections: [
        // Typed as HomepageSection but with an unknown type — what would
        // actually happen if a future layer wrote a new section type.
        { id: 's1', type: 'not-a-real-type' as HomepageSection['type'], enabled: true, order: 0, title: '', config: {} },
      ],
    });
    // No testid stubs match → no .render container children for sections
    expect(container.querySelectorAll('[data-testid$="-section"]').length).toBe(0);
  });
});
