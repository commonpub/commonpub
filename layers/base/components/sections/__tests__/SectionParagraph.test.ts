/**
 * Component-level tests for SectionParagraph — the blank-line split into
 * <p> tags is the contract.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import SectionParagraph from '../SectionParagraph.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 6,
  sectionId: 'p-1',
};

describe('SectionParagraph', () => {
  it('renders a single <p> for single-line text', () => {
    render(SectionParagraph, {
      props: { meta, config: { text: 'Just one line.', align: 'left' } },
    });
    const ps = document.querySelectorAll('.cpub-section-paragraph p');
    expect(ps.length).toBe(1);
    expect(ps[0].textContent).toBe('Just one line.');
  });

  it('splits on blank lines into multiple <p> tags', () => {
    render(SectionParagraph, {
      props: {
        meta,
        config: { text: 'First paragraph.\n\nSecond paragraph.\n\nThird.', align: 'left' },
      },
    });
    const ps = document.querySelectorAll('.cpub-section-paragraph p');
    expect(ps.length).toBe(3);
    expect(ps[0].textContent).toBe('First paragraph.');
    expect(ps[1].textContent).toBe('Second paragraph.');
    expect(ps[2].textContent).toBe('Third.');
  });

  it('drops empty paragraphs from author whitespace (defensive)', () => {
    render(SectionParagraph, {
      props: { meta, config: { text: 'One.\n\n\n\n   \n\nTwo.', align: 'left' } },
    });
    const ps = document.querySelectorAll('.cpub-section-paragraph p');
    // Two non-empty paragraphs, no empties between them
    expect(ps.length).toBe(2);
    expect(ps[0].textContent).toBe('One.');
    expect(ps[1].textContent).toBe('Two.');
  });

  it('renders nothing in the inner area when text is empty', () => {
    render(SectionParagraph, {
      props: { meta, config: { text: '', align: 'left' } },
    });
    const ps = document.querySelectorAll('.cpub-section-paragraph p');
    expect(ps.length).toBe(0);
  });

  it('exposes data-align for centered variant', () => {
    render(SectionParagraph, {
      props: { meta, config: { text: 'Hi.', align: 'center' } },
    });
    const root = document.querySelector('.cpub-section-paragraph');
    expect(root?.getAttribute('data-align')).toBe('center');
  });
});
