import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Input from '../Input.svelte';

describe('Input', () => {
  it('renders with label associated via for/id', () => {
    render(Input, { props: { id: 'name', label: 'Name' } });
    const input = screen.getByLabelText('Name');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('defaults to type=text', () => {
    render(Input, { props: { id: 'field', label: 'Field' } });
    expect(screen.getByLabelText('Field')).toHaveAttribute('type', 'text');
  });

  it('accepts type=email', () => {
    render(Input, { props: { id: 'email', label: 'Email', type: 'email' } });
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('displays error state with aria-invalid and aria-describedby', () => {
    render(Input, { props: { id: 'field', label: 'Field', error: 'Required' } });
    const input = screen.getByLabelText('Field');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'field-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('does not show error when empty', () => {
    render(Input, { props: { id: 'field', label: 'Field' } });
    const input = screen.getByLabelText('Field');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts placeholder', () => {
    render(Input, { props: { id: 'f', label: 'F', placeholder: 'Enter...' } });
    expect(screen.getByPlaceholderText('Enter...')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(Input, { props: { id: 'f', label: 'F', disabled: true } });
    expect(screen.getByLabelText('F')).toBeDisabled();
  });

  it('accepts a class prop', () => {
    const { container } = render(Input, {
      props: { id: 'f', label: 'F', class: 'custom' },
    });
    expect(container.querySelector('.snaplify-input-group')?.className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Input, {
      props: { id: 'name', label: 'Full Name' },
    });
    await expectNoA11yViolations(container);
  });

  it('passes axe scan with error state', async () => {
    const { container } = render(Input, {
      props: { id: 'name', label: 'Full Name', error: 'Required field' },
    });
    await expectNoA11yViolations(container);
  });
});
