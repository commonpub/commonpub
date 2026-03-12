import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Card from '../Card.vue';

describe('Card', () => {
  it('renders slot content', () => {
    render(Card, {
      slots: { default: '<p>Card content</p>' },
    });
    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('has base cpub-card class', () => {
    const { container } = render(Card, {
      slots: { default: 'Content' },
    });
    const card = container.querySelector('.cpub-card');
    expect(card).toBeTruthy();
  });

  it('does not have hoverable class by default', () => {
    const { container } = render(Card, {
      slots: { default: 'Content' },
    });
    const card = container.querySelector('.cpub-card');
    expect(card?.classList.contains('cpub-card--hoverable')).toBe(false);
  });

  it('has hoverable class when prop is true', () => {
    const { container } = render(Card, {
      props: { hoverable: true },
      slots: { default: 'Content' },
    });
    const card = container.querySelector('.cpub-card');
    expect(card?.classList.contains('cpub-card--hoverable')).toBe(true);
  });

  it('passes through attrs', () => {
    const { container } = render(Card, {
      attrs: { 'data-testid': 'my-card' },
      slots: { default: 'Content' },
    });
    expect(container.querySelector('[data-testid="my-card"]')).toBeTruthy();
  });
});
