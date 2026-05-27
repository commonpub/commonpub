/**
 * Component-level tests for SectionCta.
 *
 * Pure render component (no fetch). Asserts heading + body + buttons +
 * variant data-attrs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import SectionCta from '../SectionCta.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'cta-1',
};

interface CtaConfigForTest extends Record<string, unknown> {
  variant: 'default' | 'contrast' | 'minimal';
  heading: string;
  body: string;
  buttons: Array<{ label: string; href: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  align: 'left' | 'center';
}

const baseConfig: CtaConfigForTest = {
  variant: 'default',
  heading: 'Get started today',
  body: '',
  buttons: [],
  align: 'left',
};

afterEach(() => { document.body.innerHTML = ''; });

describe('SectionCta — render', () => {
  it('renders heading + section with aria-labelledby wired', () => {
    render(SectionCta, { props: { meta, config: baseConfig } });
    const heading = document.querySelector('.cpub-section-cta-heading') as HTMLElement;
    const section = document.querySelector('.cpub-section-cta');
    expect(heading?.textContent?.trim()).toBe('Get started today');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.id).toBe(`section-cta-${meta.sectionId}`);
  });

  it('renders body only when set', () => {
    render(SectionCta, { props: { meta, config: { ...baseConfig, body: 'Join thousands.' } } });
    expect(document.querySelector('.cpub-section-cta-body')?.textContent?.trim()).toBe('Join thousands.');

    document.body.innerHTML = '';
    render(SectionCta, { props: { meta, config: { ...baseConfig, body: '' } } });
    expect(document.querySelector('.cpub-section-cta-body')).toBeNull();
  });

  it('renders each button with label + href + variant class', () => {
    render(SectionCta, { props: { meta, config: {
      ...baseConfig,
      buttons: [
        { label: 'Start', href: '/create', variant: 'primary' },
        { label: 'Learn more', href: '/learn', variant: 'secondary' },
        { label: 'Skip', href: '#skip', variant: 'ghost' },
      ],
    }}});
    const btns = document.querySelectorAll('.cpub-section-cta-btn');
    expect(btns.length).toBe(3);
    expect(btns[0]?.getAttribute('href')).toBe('/create');
    expect(btns[0]?.classList.contains('cpub-section-cta-btn-primary')).toBe(true);
    expect(btns[1]?.classList.contains('cpub-section-cta-btn-secondary')).toBe(true);
    expect(btns[2]?.classList.contains('cpub-section-cta-btn-ghost')).toBe(true);
  });

  it('renders nothing in actions container when no buttons', () => {
    render(SectionCta, { props: { meta, config: baseConfig } });
    expect(document.querySelector('.cpub-section-cta-actions')).toBeNull();
  });

  it.each(['default', 'contrast', 'minimal'] as const)(
    'sets data-variant=%s on the section',
    (variant) => {
      render(SectionCta, { props: { meta, config: { ...baseConfig, variant } } });
      expect(document.querySelector('.cpub-section-cta')?.getAttribute('data-variant')).toBe(variant);
    },
  );

  it.each(['left', 'center'] as const)(
    'sets data-align=%s on the section',
    (align) => {
      render(SectionCta, { props: { meta, config: { ...baseConfig, align } } });
      expect(document.querySelector('.cpub-section-cta')?.getAttribute('data-align')).toBe(align);
    },
  );
});
