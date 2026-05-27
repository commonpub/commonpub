/**
 * Component-level tests for SectionMarkdown.
 *
 * Stubs useAsyncData + @commonpub/docs's renderMarkdown so the test
 * doesn't depend on the full remark/rehype pipeline. The render path
 * + heading conditional + section-not-rendered-when-empty branch are
 * what we're pinning.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { ref } from 'vue';

// Mock renderMarkdown BEFORE importing the component
vi.mock('@commonpub/docs', () => ({
  renderMarkdown: vi.fn().mockResolvedValue({
    html: '<p>mocked <strong>html</strong></p>',
    toc: [],
    frontmatter: {},
  }),
}));

import SectionMarkdown from '../SectionMarkdown.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'md-1',
};

interface MarkdownConfigForTest extends Record<string, unknown> {
  heading: string;
  body: string;
}

function mountMd(
  config: MarkdownConfigForTest,
  asyncResult: { html: string } | null = { html: '<p>mocked</p>' },
): void {
  (globalThis as Record<string, unknown>).useAsyncData = vi.fn().mockImplementation(
    () => ({ data: ref(asyncResult), pending: ref(false), error: ref(null) }),
  );

  render(SectionMarkdown, { props: { meta, config } });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useAsyncData;
  document.body.innerHTML = '';
});

describe('SectionMarkdown — render', () => {
  it('renders the rendered HTML body via v-html', () => {
    mountMd({ heading: '', body: '# Hello' }, { html: '<h1>Hello</h1>' });
    const body = document.querySelector('.cpub-section-markdown-body');
    expect(body?.querySelector('h1')?.textContent).toBe('Hello');
  });

  it('renders nothing when config.body is empty', () => {
    mountMd({ heading: '', body: '' });
    expect(document.querySelector('.cpub-section-markdown')).toBeNull();
  });

  it('renders heading + wires aria-labelledby when heading set', () => {
    mountMd({ heading: 'About us', body: 'text' }, { html: '<p>text</p>' });
    const section = document.querySelector('.cpub-section-markdown');
    const heading = document.querySelector('.cpub-section-markdown-heading') as HTMLElement;
    expect(heading?.textContent?.trim()).toBe('About us');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.id).toBe(`section-md-${meta.sectionId}`);
  });

  it('omits heading element when config.heading is empty', () => {
    mountMd({ heading: '', body: 'text' }, { html: '<p>text</p>' });
    expect(document.querySelector('.cpub-section-markdown-heading')).toBeNull();
    expect(document.querySelector('.cpub-section-markdown')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('uses cpub-prose class for typography inheritance', () => {
    mountMd({ heading: '', body: 'text' });
    expect(document.querySelector('.cpub-section-markdown-body')?.classList.contains('cpub-prose')).toBe(true);
  });

  it('renders an empty body container when async returns null/undefined (fail-safe)', () => {
    mountMd({ heading: '', body: 'text' }, null);
    const body = document.querySelector('.cpub-section-markdown-body');
    expect(body?.innerHTML).toBe('');
  });
});
