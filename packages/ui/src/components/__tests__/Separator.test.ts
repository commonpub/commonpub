import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { expectNoA11yViolations } from '../../test-helpers';
import Separator from '../Separator.svelte';

describe('Separator', () => {
  it('renders with role=separator', () => {
    render(Separator);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('defaults to horizontal', () => {
    render(Separator);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
    expect(sep.className).toContain('snaplify-separator--horizontal');
  });

  it('supports vertical orientation', () => {
    render(Separator, { props: { orientation: 'vertical' } });
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'vertical');
    expect(sep.className).toContain('snaplify-separator--vertical');
  });

  it('accepts a class prop', () => {
    render(Separator, { props: { class: 'custom' } });
    expect(screen.getByRole('separator').className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Separator);
    await expectNoA11yViolations(container);
  });
});
