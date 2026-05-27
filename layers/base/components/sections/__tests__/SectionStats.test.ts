/**
 * Component-level tests for SectionStats.
 *
 * Stubs both useFetch (PlatformStats) and useFeatures (hubs gate).
 * Asserts: numbers render, hubs cell hides when feature is off, posts
 * adds blog + legacy article counts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { ref, computed } from 'vue';
import SectionStats from '../SectionStats.vue';

const meta = {
  route: '/',
  zone: 'sidebar',
  isPreview: false,
  effectiveColSpan: 4,
  sectionId: 'stats-1',
};

interface StatsResponse {
  content?: { byType?: { project?: number; blog?: number; article?: number } };
  users?: { total?: number };
  hubs?: { total?: number };
}

function mountStats(stats: StatsResponse | null, hubs = true, pending = false): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    () => ({ data: ref(stats), pending: ref(pending) }),
  );
  (globalThis as Record<string, unknown>).useFeatures = vi.fn(() => ({
    features: ref({}),
    hubs: computed(() => hubs),
  }));

  render(SectionStats, {
    props: { meta, config: { heading: 'Platform Stats' } },
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFetch;
  delete (globalThis as Record<string, unknown>).useFeatures;
  document.body.innerHTML = '';
});

describe('SectionStats — render', () => {
  it('renders all four cells when hubs flag is ON', () => {
    mountStats({
      content: { byType: { project: 12, blog: 7, article: 3 } },
      users: { total: 42 },
      hubs: { total: 5 },
    }, true);

    const blocks = document.querySelectorAll('.cpub-section-stats-block');
    expect(blocks.length).toBe(4);
  });

  it('hides the hubs cell when hubs flag is OFF', () => {
    mountStats({
      content: { byType: { project: 12 } },
      users: { total: 42 },
      hubs: { total: 5 },
    }, false);

    const blocks = document.querySelectorAll('.cpub-section-stats-block');
    expect(blocks.length).toBe(3);
    expect(document.body.textContent).not.toContain('Hubs');
  });

  it('sums posts as blog + article (legacy alias)', () => {
    mountStats({
      content: { byType: { project: 0, blog: 7, article: 3 } },
      users: { total: 0 },
    }, false);

    // Find the Posts dd's number — it's the second dd because order is
    // Projects(0)/Posts(10)/Members(0)
    const dds = document.querySelectorAll('.cpub-section-stats-block dd');
    const postsValue = dds[1]?.textContent?.trim();
    expect(postsValue).toBe('10');
  });

  it('defaults missing counts to 0', () => {
    mountStats({}, false);
    const numbers = Array.from(document.querySelectorAll('.cpub-section-stats-block dd'))
      .map((el) => el.textContent?.trim());
    expect(numbers).toEqual(['0', '0', '0']);
  });

  it('shows the loading state while pending', () => {
    mountStats(null, false, true);
    expect(document.querySelector('.cpub-section-stats-loading')).not.toBeNull();
    expect(document.querySelector('.cpub-section-stats-grid')).toBeNull();
  });

  it('renders the heading when set', () => {
    mountStats({}, false);
    const heading = document.querySelector('.cpub-section-stats-heading');
    expect(heading?.textContent?.trim()).toBe('Platform Stats');
  });
});
