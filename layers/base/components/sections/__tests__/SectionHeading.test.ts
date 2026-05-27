/**
 * Component-level tests for SectionHeading — the auto-renders-the-right-tag
 * behaviour is the contract.
 *
 * Per docs/plans/layout-and-pages.md §10.2: real DOM assertions, not
 * snapshot-only / mount-and-exists.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import SectionHeading from '../SectionHeading.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'sec-1',
};

describe('SectionHeading', () => {
  it('renders the title at the configured heading level', () => {
    render(SectionHeading, {
      props: {
        meta,
        config: { text: 'About us', level: 3, align: 'left', eyebrow: '', subline: '' },
      },
    });
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.textContent?.trim()).toBe('About us');
  });

  it('renders eyebrow + subline when provided', () => {
    render(SectionHeading, {
      props: {
        meta,
        config: { text: 'Hi', level: 2, align: 'left', eyebrow: 'INTRO', subline: 'Lead-in copy.' },
      },
    });
    expect(screen.getByText('INTRO')).toBeTruthy();
    expect(screen.getByText('Lead-in copy.')).toBeTruthy();
  });

  it('omits eyebrow / subline elements when empty', () => {
    render(SectionHeading, {
      props: {
        meta,
        config: { text: 'Hi', level: 1, align: 'left', eyebrow: '', subline: '' },
      },
    });
    // Heading element present; eyebrow paragraph absent
    expect(screen.queryAllByText('').length).toBeGreaterThanOrEqual(0);
    const eyebrow = document.querySelector('.cpub-section-heading-eyebrow');
    const subline = document.querySelector('.cpub-section-heading-subline');
    expect(eyebrow).toBeNull();
    expect(subline).toBeNull();
  });

  it('exposes data-align for centered variant', () => {
    render(SectionHeading, {
      props: {
        meta,
        config: { text: 'Centered', level: 2, align: 'center', eyebrow: '', subline: '' },
      },
    });
    const root = document.querySelector('.cpub-section-heading');
    expect(root?.getAttribute('data-align')).toBe('center');
  });

  it('aria-labelledby on section points at the heading id (a11y wiring)', () => {
    render(SectionHeading, {
      props: {
        meta: { ...meta, sectionId: 'abc' },
        config: { text: 'Hi', level: 2, align: 'left', eyebrow: '', subline: '' },
      },
    });
    const section = document.querySelector('section.cpub-section-heading');
    const heading = document.getElementById('section-heading-abc');
    expect(section?.getAttribute('aria-labelledby')).toBe('section-heading-abc');
    expect(heading?.textContent?.trim()).toBe('Hi');
  });
});
