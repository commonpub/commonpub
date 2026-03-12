import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Avatar from '../Avatar.vue';

describe('Avatar', () => {
  it('renders with image when src is provided', () => {
    const { container } = render(Avatar, {
      props: { src: 'https://example.com/photo.jpg', alt: 'User photo' },
    });
    const wrapper = container.querySelector('.cpub-avatar');
    expect(wrapper).toBeTruthy();
    const imgEl = container.querySelector('img');
    expect(imgEl).toBeTruthy();
    expect(imgEl?.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('shows fallback initials when no src', () => {
    render(Avatar, {
      props: { fallback: 'JD' },
    });
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('derives initials from alt text', () => {
    render(Avatar, {
      props: { alt: 'Jane Doe' },
    });
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('shows fallback on image error', async () => {
    render(Avatar, {
      props: { src: 'broken.jpg', alt: 'Test User' },
    });
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    await fireEvent.error(img!);
    expect(screen.getByText('TU')).toBeTruthy();
  });

  it('applies size classes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    for (const size of sizes) {
      const { container, unmount } = render(Avatar, {
        props: { size, fallback: 'A' },
      });
      const avatar = container.querySelector('.cpub-avatar');
      expect(avatar?.classList.contains(`cpub-avatar--${size}`)).toBe(true);
      unmount();
    }
  });

  it('defaults to md size', () => {
    const { container } = render(Avatar, {
      props: { fallback: 'A' },
    });
    const avatar = container.querySelector('.cpub-avatar');
    expect(avatar?.classList.contains('cpub-avatar--md')).toBe(true);
  });

  it('has role="img" for accessibility', () => {
    render(Avatar, {
      props: { alt: 'Test' },
    });
    expect(screen.getByRole('img')).toBeTruthy();
  });
});
