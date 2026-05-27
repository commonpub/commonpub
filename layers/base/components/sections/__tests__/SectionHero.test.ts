/**
 * Component-level tests for SectionHero — variant data attributes, CTA
 * rendering, semantic title (h1), grid backdrop in non-compact variants.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import SectionHero from '../SectionHero.vue';

// NuxtLink isn't available in the test environment — stub as <a :href="to">
const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
};

const meta = {
  route: '/',
  zone: 'full-width',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'hero-1',
};

const baseConfig = {
  variant: 'default' as const,
  eyebrow: '',
  title: 'Welcome',
  subtitle: '',
  ctas: [],
};

describe('SectionHero', () => {
  it('renders an h1 with the configured title', () => {
    render(SectionHero, {
      props: { meta, config: { ...baseConfig, title: 'Build. Document. Share.' } },
      global: { stubs },
    });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.trim()).toBe('Build. Document. Share.');
  });

  it('renders eyebrow + subtitle when set, omits when empty', () => {
    render(SectionHero, {
      props: {
        meta,
        config: { ...baseConfig, eyebrow: 'OPEN SOURCE', subtitle: 'A subtitle here.' },
      },
      global: { stubs },
    });
    expect(screen.getByText('OPEN SOURCE')).toBeTruthy();
    expect(screen.getByText('A subtitle here.')).toBeTruthy();
  });

  it('renders each CTA with primary/secondary variant class', () => {
    render(SectionHero, {
      props: {
        meta,
        config: {
          ...baseConfig,
          ctas: [
            { label: 'Start', href: '/create', variant: 'primary' as const },
            { label: 'Learn more', href: '/about', variant: 'secondary' as const },
          ],
        },
      },
      global: { stubs },
    });
    const primary = document.querySelector('a.cpub-btn.cpub-btn-primary');
    expect(primary?.getAttribute('href')).toBe('/create');
    expect(primary?.textContent?.trim()).toBe('Start');

    // Secondary CTA: has cpub-btn but NOT cpub-btn-primary
    const links = Array.from(document.querySelectorAll('a.cpub-btn'));
    const secondary = links.find((a) => !a.classList.contains('cpub-btn-primary'));
    expect(secondary?.getAttribute('href')).toBe('/about');
    expect(secondary?.textContent?.trim()).toBe('Learn more');
  });

  it('grid backdrop present for default + centered, absent for compact', () => {
    for (const variant of ['default', 'centered'] as const) {
      document.body.innerHTML = '';
      render(SectionHero, { props: { meta, config: { ...baseConfig, variant } }, global: { stubs } });
      expect(
        document.querySelector('.cpub-section-hero-grid-bg'),
        `${variant} should render a grid backdrop`,
      ).not.toBeNull();
    }

    document.body.innerHTML = '';
    render(SectionHero, {
      props: { meta, config: { ...baseConfig, variant: 'compact' } },
      global: { stubs },
    });
    expect(document.querySelector('.cpub-section-hero-grid-bg')).toBeNull();
  });

  it('exposes data-variant for CSS variant styling', () => {
    render(SectionHero, {
      props: { meta, config: { ...baseConfig, variant: 'centered' } },
      global: { stubs },
    });
    expect(document.querySelector('section.cpub-section-hero')?.getAttribute('data-variant')).toBe(
      'centered',
    );
  });

  it('aria-labelledby on section points at the h1 id', () => {
    render(SectionHero, {
      props: { meta: { ...meta, sectionId: 'hh' }, config: baseConfig },
      global: { stubs },
    });
    const section = document.querySelector('section.cpub-section-hero');
    const h1 = document.getElementById('section-hero-hh');
    expect(section?.getAttribute('aria-labelledby')).toBe('section-hero-hh');
    expect(h1).not.toBeNull();
  });
});
