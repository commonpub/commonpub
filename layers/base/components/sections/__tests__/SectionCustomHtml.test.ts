/**
 * Component-level tests for SectionCustomHtml.
 *
 * Asserts: no render when html is empty, v-html injection when set,
 * heading is optional, aria-labelledby wired correctly.
 *
 * Security note: this section ships intentionally unsanitised (matches
 * legacy `CustomHtmlSection.vue` baseline). Phase 6b adds DOMPurify at
 * admin-write time. See `builtin/custom-html.ts` for the threat model.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import SectionCustomHtml from '../SectionCustomHtml.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'custom-1',
};

afterEach(() => { document.body.innerHTML = ''; });

describe('SectionCustomHtml — render', () => {
  it('renders nothing when html is empty', () => {
    render(SectionCustomHtml, {
      props: { meta, config: { heading: '', html: '' } },
    });
    expect(document.querySelector('.cpub-section-custom-html')).toBeNull();
  });

  it('renders sanitisable HTML via v-html when set', () => {
    render(SectionCustomHtml, {
      props: { meta, config: { heading: '', html: '<p class="hello">Hi <strong>there</strong></p>' } },
    });
    const body = document.querySelector('.cpub-section-custom-html-body');
    expect(body).not.toBeNull();
    expect(body?.querySelector('p.hello')).not.toBeNull();
    expect(body?.querySelector('strong')?.textContent).toBe('there');
  });

  it('renders heading only when set + wires aria-labelledby', () => {
    render(SectionCustomHtml, {
      props: { meta, config: { heading: 'Banner', html: '<p>x</p>' } },
    });
    const section = document.querySelector('.cpub-section-custom-html');
    const heading = document.querySelector('.cpub-section-custom-html-heading') as HTMLElement;
    expect(heading?.textContent?.trim()).toBe('Banner');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.id).toBe(`section-custom-${meta.sectionId}`);
  });

  it('omits aria-labelledby when no heading', () => {
    render(SectionCustomHtml, {
      props: { meta, config: { heading: '', html: '<p>x</p>' } },
    });
    const section = document.querySelector('.cpub-section-custom-html');
    expect(section?.hasAttribute('aria-labelledby')).toBe(false);
  });

  // Documenting the security posture as a test — if someone later adds
  // sanitization (good!) this test will need to be updated, which is a
  // good prompt to also flip the section's `status: 'beta'` to 'stable'
  // and remove the Phase 6b TODO in builtin/custom-html.ts.
  it('SECURITY POSTURE: passes HTML through unsanitised (Phase 1c baseline)', () => {
    const html = '<script data-marker="raw">x</script><a href="javascript:void(0)" data-marker="raw-href">x</a>';
    render(SectionCustomHtml, {
      props: { meta, config: { heading: '', html } },
    });
    const body = document.querySelector('.cpub-section-custom-html-body');
    // jsdom's innerHTML doesn't EXECUTE the script, but the marker is
    // present in the DOM — proves no client-side sanitisation stripped
    // the tag. When Phase 6b adds DOMPurify at admin-write, the stored
    // value will already be safe and this test should be flipped.
    expect(body?.querySelector('[data-marker="raw"]')).not.toBeNull();
    expect(body?.querySelector('[data-marker="raw-href"]')?.getAttribute('href')).toBe('javascript:void(0)');
  });
});
