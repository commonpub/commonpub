import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { expectNoA11yViolations } from '../../test-helpers';
import Avatar from '../Avatar.svelte';

describe('Avatar', () => {
  it('renders with role=img and alt text', () => {
    render(Avatar, { props: { alt: 'Jane Doe', name: 'Jane Doe' } });
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('aria-label', 'Jane Doe');
  });

  it('shows initials as fallback', () => {
    render(Avatar, { props: { alt: 'Jane Doe', name: 'Jane Doe' } });
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('shows single initial for single name', () => {
    render(Avatar, { props: { alt: 'Alice', name: 'Alice' } });
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders image when src provided', () => {
    const { container } = render(Avatar, {
      props: { alt: 'Jane', src: 'https://example.com/avatar.jpg' },
    });
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('applies size class', () => {
    const { container } = render(Avatar, {
      props: { alt: 'Jane', name: 'Jane', size: 'lg' },
    });
    expect(container.querySelector('.snaplify-avatar')?.className).toContain(
      'snaplify-avatar--lg'
    );
  });

  it('accepts a class prop', () => {
    const { container } = render(Avatar, {
      props: { alt: 'Jane', name: 'Jane', class: 'custom' },
    });
    expect(container.querySelector('.snaplify-avatar')?.className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Avatar, {
      props: { alt: 'Jane Doe avatar', name: 'Jane Doe' },
    });
    await expectNoA11yViolations(container);
  });
});
