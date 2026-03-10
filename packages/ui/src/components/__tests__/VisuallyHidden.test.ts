import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { expectNoA11yViolations } from '../../test-helpers';
import VisuallyHidden from '../VisuallyHidden.svelte';

describe('VisuallyHidden', () => {
  it('renders content for screen readers', () => {
    render(VisuallyHidden, { props: { text: 'Skip to main content' } });
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('applies sr-only styles', () => {
    render(VisuallyHidden, { props: { text: 'Hidden text' } });
    const el = screen.getByText('Hidden text');
    expect(el).toHaveStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
    });
  });

  it('accepts a class prop', () => {
    render(VisuallyHidden, { props: { text: 'Test', class: 'extra' } });
    const el = screen.getByText('Test');
    expect(el.className).toContain('extra');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(VisuallyHidden, { props: { text: 'Accessible' } });
    await expectNoA11yViolations(container);
  });
});
