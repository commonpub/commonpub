/**
 * XSS-proving tests for CustomHtmlSection (audit session 204 — P1).
 *
 * Admin-authored raw HTML renders on the PUBLIC homepage via v-html. The fix
 * runs `config.html` through `sanitizeRichHtml` before binding, so script tags,
 * `on*` event handlers and `javascript:` URLs cannot execute, while safe
 * presentational markup is preserved.
 *
 * These render the real component and inspect the rendered DOM/HTML directly.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import CustomHtmlSection from '../homepage/CustomHtmlSection.vue';

const MALICIOUS = [
  '<strong>safe bold</strong>',
  '<p>hello world</p>',
  '<script>alert(1)</script>',
  '<img src="x" onerror="alert(2)" alt="boom">',
  '<a href="javascript:alert(3)">click</a>',
].join('');

function mount(html: string, title?: string) {
  return render(CustomHtmlSection, {
    props: { config: { html } as never, title },
  });
}

describe('CustomHtmlSection — sanitizes admin HTML before v-html', () => {
  it('strips <script> tags and their payload', () => {
    const { container } = mount(MALICIOUS);
    const out = container.innerHTML;
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips on* event-handler attributes (onerror)', () => {
    const { container } = mount(MALICIOUS);
    const out = container.innerHTML.toLowerCase();
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(2)');
    // the <img> itself survives, just without the handler
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('strips javascript: URLs from anchors', () => {
    const { container } = mount(MALICIOUS);
    const anchor = container.querySelector('a');
    // href is dropped (unsafe scheme); definitely not a javascript: URL
    expect(anchor?.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
  });

  it('KEEPS safe presentational markup (<strong>, <p>)', () => {
    const { container } = mount(MALICIOUS);
    expect(container.querySelector('strong')?.textContent).toBe('safe bold');
    expect(container.textContent).toContain('hello world');
  });

  it('renders nothing when config.html is empty', () => {
    const { container } = mount('');
    expect(container.querySelector('.cpub-custom-section')).toBeNull();
  });
});
