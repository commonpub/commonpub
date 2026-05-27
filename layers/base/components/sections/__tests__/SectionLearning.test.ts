/**
 * Component-level tests for SectionLearning.
 *
 * Asserts: query forwards limit, grid + cards render with metadata,
 * empty + loading states, heading conditional.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { ref, defineComponent, h } from 'vue';
import SectionLearning from '../SectionLearning.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'learning-1',
};

interface LearningConfigForTest extends Record<string, unknown> {
  heading: string;
  limit: number;
  columns: 1 | 2 | 3 | 4;
}

const baseConfig: LearningConfigForTest = { heading: 'Learning Paths', limit: 6, columns: 3 };

type FetchCall = { url: string; query: Record<string, unknown> };
let calls: FetchCall[] = [];

interface PathStub {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  difficulty?: string | null;
  estimatedHours?: string | null;
  enrollmentCount?: number;
  moduleCount?: number;
}

const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

function mountLearning(
  fetchResult: { items?: PathStub[]; pending?: boolean } = {},
  config: LearningConfigForTest = baseConfig,
): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    (url: string, opts: { query: { value: Record<string, unknown> } | Record<string, unknown> }) => {
      const rawQuery = opts?.query;
      const query =
        rawQuery && typeof rawQuery === 'object' && 'value' in rawQuery
          ? (rawQuery as { value: Record<string, unknown> }).value
          : (rawQuery as Record<string, unknown>) ?? {};
      calls.push({ url, query });
      return {
        data: ref({ items: fetchResult.items ?? [] }),
        pending: ref(fetchResult.pending ?? false),
      };
    },
  );

  render(SectionLearning, {
    props: { meta, config },
    global: { components: { NuxtLink: NuxtLinkStub } },
  });
}

beforeEach(() => { calls = []; });
afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFetch;
  document.body.innerHTML = '';
});

describe('SectionLearning — query building', () => {
  it('forwards limit to /api/learn', () => {
    mountLearning({}, { ...baseConfig, limit: 8 });
    expect(calls[0].url).toBe('/api/learn');
    expect((calls[0].query as { limit: number }).limit).toBe(8);
  });

  it('clamps limit into [1, 12]', () => {
    mountLearning({}, { ...baseConfig, limit: 999 });
    expect((calls[0].query as { limit: number }).limit).toBe(12);
  });
});

describe('SectionLearning — render', () => {
  it('renders one card per path with title + chips', () => {
    mountLearning({
      items: [
        {
          id: '1', slug: 'a', title: 'Solder 101',
          description: 'Learn the basics', difficulty: 'beginner',
          estimatedHours: '2', enrollmentCount: 42, moduleCount: 5,
        },
      ],
    });
    expect(document.body.textContent).toContain('Solder 101');
    expect(document.body.textContent).toContain('Learn the basics');
    expect(document.body.textContent).toContain('beginner');
    expect(document.body.textContent).toContain('2h');
    expect(document.body.textContent).toContain('42 enrolled');
  });

  it('omits difficulty + duration chips when null', () => {
    mountLearning({
      items: [{ id: '1', slug: 'a', title: 'X', enrollmentCount: 0 }],
    });
    const chips = document.querySelectorAll('.cpub-section-learning-chip');
    // Only the enrolled chip should render
    expect(chips.length).toBe(1);
    expect(chips[0].textContent?.trim()).toBe('0 enrolled');
  });

  it('renders cover image as background when present', () => {
    mountLearning({
      items: [{
        id: '1', slug: 'a', title: 'X', enrollmentCount: 0,
        coverImageUrl: 'https://cdn.example/x.jpg',
      }],
    });
    const cover = document.querySelector('.cpub-section-learning-cover') as HTMLElement;
    expect(cover?.style.backgroundImage).toContain('https://cdn.example/x.jpg');
  });

  it('shows empty state for no paths', () => {
    mountLearning({ items: [] });
    expect(document.querySelector('.cpub-section-learning-empty')).not.toBeNull();
  });

  it('shows loading state while pending', () => {
    mountLearning({ items: [], pending: true });
    expect(document.querySelector('.cpub-section-learning-loading')).not.toBeNull();
  });

  it('exposes data-columns for CSS to consume', () => {
    mountLearning({ items: [{ id: '1', slug: 'a', title: 'X', enrollmentCount: 0 }] }, { ...baseConfig, columns: 2 });
    expect(document.querySelector('.cpub-section-learning-grid')?.getAttribute('data-columns')).toBe('2');
  });
});
