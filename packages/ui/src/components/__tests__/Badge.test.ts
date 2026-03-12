import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Badge from '../Badge.vue';

describe('Badge', () => {
  it('renders slot content', () => {
    render(Badge, {
      slots: { default: 'New' },
    });
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('applies default variant class', () => {
    const { container } = render(Badge, {
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--default')).toBe(true);
  });

  it('applies accent variant class', () => {
    const { container } = render(Badge, {
      props: { variant: 'accent' },
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--accent')).toBe(true);
  });

  it('applies green variant class', () => {
    const { container } = render(Badge, {
      props: { variant: 'green' },
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--green')).toBe(true);
  });

  it('applies red variant class', () => {
    const { container } = render(Badge, {
      props: { variant: 'red' },
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--red')).toBe(true);
  });

  it('applies outline variant class', () => {
    const { container } = render(Badge, {
      props: { variant: 'outline' },
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--outline')).toBe(true);
  });

  it('applies sm size class by default', () => {
    const { container } = render(Badge, {
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--sm')).toBe(true);
  });

  it('applies md size class', () => {
    const { container } = render(Badge, {
      props: { size: 'md' },
      slots: { default: 'Tag' },
    });
    const badge = container.querySelector('.cpub-badge');
    expect(badge?.classList.contains('cpub-badge--md')).toBe(true);
  });
});
