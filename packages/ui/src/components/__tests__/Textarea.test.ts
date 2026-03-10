import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { expectNoA11yViolations } from '../../test-helpers';
import Textarea from '../Textarea.svelte';

describe('Textarea', () => {
  it('renders with label associated via for/id', () => {
    render(Textarea, { props: { id: 'bio', label: 'Bio' } });
    const textarea = screen.getByLabelText('Bio');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('uses default rows=4', () => {
    render(Textarea, { props: { id: 'bio', label: 'Bio' } });
    expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '4');
  });

  it('accepts custom rows', () => {
    render(Textarea, { props: { id: 'bio', label: 'Bio', rows: 8 } });
    expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '8');
  });

  it('displays error state with aria-invalid and aria-describedby', () => {
    render(Textarea, { props: { id: 'bio', label: 'Bio', error: 'Too short' } });
    const textarea = screen.getByLabelText('Bio');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('aria-describedby', 'bio-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('can be disabled', () => {
    render(Textarea, { props: { id: 'bio', label: 'Bio', disabled: true } });
    expect(screen.getByLabelText('Bio')).toBeDisabled();
  });

  it('accepts a class prop', () => {
    const { container } = render(Textarea, {
      props: { id: 'bio', label: 'Bio', class: 'custom' },
    });
    expect(container.querySelector('.snaplify-textarea-group')?.className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Textarea, {
      props: { id: 'bio', label: 'Biography' },
    });
    await expectNoA11yViolations(container);
  });
});
