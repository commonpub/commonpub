import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockSponsorsView from '../BlockSponsorsView.vue';

const logos = [
  { src: 'https://cdn.test/a.png', alt: 'Qualcomm', url: 'https://qualcomm.com' },
  { src: 'https://cdn.test/b.png', alt: 'Arduino' },
  { src: '', alt: 'No image' }, // dropped (no src)
];

describe('BlockSponsorsView', () => {
  it('renders an eyebrow heading and one item per logo with a src', () => {
    const { container, getByText } = render(BlockSponsorsView, { props: { content: { heading: 'Sponsors', logos } } });
    getByText('Sponsors');
    expect(container.querySelectorAll('.cpub-spon-item').length).toBe(2);
    expect(container.querySelectorAll('img').length).toBe(2);
  });

  it('links a logo only when it has an http(s) url, with an accessible name', () => {
    const { container } = render(BlockSponsorsView, { props: { content: { logos } } });
    const links = container.querySelectorAll('a.cpub-spon-link');
    expect(links.length).toBe(1);
    expect(links[0]!.getAttribute('href')).toBe('https://qualcomm.com');
    expect(links[0]!.getAttribute('aria-label')).toBe('Qualcomm');
    expect(links[0]!.getAttribute('rel')).toContain('noopener');
  });

  it('groups by tier and shows tier labels only when a tier is set', () => {
    const tiered = render(BlockSponsorsView, { props: { content: { logos: [
      { src: 'x', alt: 'A', tier: 'Gold' }, { src: 'y', alt: 'B', tier: 'Gold' }, { src: 'z', alt: 'C', tier: 'Silver' },
    ] } } });
    expect(tiered.container.querySelectorAll('.cpub-spon-tier').length).toBe(2);
    expect([...tiered.container.querySelectorAll('.cpub-spon-tier-label')].map((e) => e.textContent)).toEqual(['Gold', 'Silver']);

    const flat = render(BlockSponsorsView, { props: { content: { logos } } });
    expect(flat.container.querySelectorAll('.cpub-spon-tier').length).toBe(1);
    expect(flat.container.querySelector('.cpub-spon-tier-label')).toBeNull();
  });

  it('renders nothing without usable logos', () => {
    const { container } = render(BlockSponsorsView, { props: { content: { logos: [{ src: '', alt: 'x' }] } } });
    expect(container.querySelector('.cpub-spon')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockSponsorsView, { props: { content: { heading: 'Sponsors', logos } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
