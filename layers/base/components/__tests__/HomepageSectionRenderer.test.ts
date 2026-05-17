/**
 * Regression test for HomepageSectionRenderer feature-gating.
 *
 * Session 145 audit: `isFeatureEnabled()` indexed the `features` Ref object
 * directly instead of `.value`, so every `featureGate` resolved to
 * `undefined ?? true` and gated homepage sections rendered even when their
 * flag was off (standing rule #2 violation). These tests lock the fix:
 * a section whose `featureGate` flag is false must NOT render; true must.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { ref } from 'vue';
import HomepageSectionRenderer from '../homepage/HomepageSectionRenderer.vue';

const stubs = {
  HomepageContestsSection: { template: '<div data-testid="contests-section" />' },
};

function mountWith(contestsEnabled: boolean) {
  // Mirror test-setup.ts's approach of globalizing Nuxt auto-imports.
  (globalThis as Record<string, unknown>).useFeatures = () => ({
    features: ref({ contests: contestsEnabled }),
  });
  return render(HomepageSectionRenderer, {
    props: {
      zone: 'sidebar', // 'contests' is a SIDEBAR_TYPES section
      sections: [
        {
          id: 's1',
          type: 'contests',
          enabled: true,
          order: 0,
          title: 'Contests',
          config: { featureGate: 'contests' },
        },
      ],
    },
    global: { stubs },
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFeatures;
});

describe('HomepageSectionRenderer feature gating', () => {
  it('hides a gated section when its feature flag is false', () => {
    mountWith(false);
    expect(screen.queryByTestId('contests-section')).toBeNull();
  });

  it('renders a gated section when its feature flag is true', () => {
    mountWith(true);
    expect(screen.queryByTestId('contests-section')).not.toBeNull();
  });
});
