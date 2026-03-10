import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Badge from '../Badge.svelte';

describe('Badge', () => {
  it('renders text', () => {
    render(Badge, { props: { text: 'New' } });
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies default variant', () => {
    render(Badge, { props: { text: 'Tag' } });
    expect(screen.getByText('Tag').className).toContain('snaplify-badge--default');
  });

  it('applies variant class', () => {
    render(Badge, { props: { text: 'Error', variant: 'danger' } });
    expect(screen.getByText('Error').className).toContain('snaplify-badge--danger');
  });

  it('applies size class', () => {
    render(Badge, { props: { text: 'Small', size: 'sm' } });
    expect(screen.getByText('Small').className).toContain('snaplify-badge--sm');
  });

  it('accepts a class prop', () => {
    render(Badge, { props: { text: 'Custom', class: 'my-badge' } });
    expect(screen.getByText('Custom').className).toContain('my-badge');
  });
});
