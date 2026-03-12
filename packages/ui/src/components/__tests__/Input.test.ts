import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Input from '../Input.vue';

describe('Input', () => {
  it('renders an input element', () => {
    render(Input);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('renders with a label', () => {
    render(Input, {
      props: { label: 'Email' },
    });
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('emits update:modelValue on input', async () => {
    const { emitted } = render(Input, {
      props: { modelValue: '' },
    });
    const input = screen.getByRole('textbox');
    await fireEvent.update(input, 'hello');
    expect(emitted()['update:modelValue']).toBeTruthy();
  });

  it('displays the current value', () => {
    render(Input, {
      props: { modelValue: 'test value' },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('shows error message', () => {
    render(Input, {
      props: { error: 'This field is required' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
  });

  it('sets aria-invalid when error is present', () => {
    render(Input, {
      props: { error: 'Required' },
    });
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows hint text', () => {
    render(Input, {
      props: { hint: 'Enter your email' },
    });
    expect(screen.getByText('Enter your email')).toBeTruthy();
  });

  it('does not show hint when error is present', () => {
    render(Input, {
      props: { hint: 'Enter your email', error: 'Required' },
    });
    expect(screen.queryByText('Enter your email')).toBeNull();
  });

  it('has error class when error is present', () => {
    const { container } = render(Input, {
      props: { error: 'Required' },
    });
    const group = container.querySelector('.cpub-input-group');
    expect(group?.classList.contains('cpub-input-group--error')).toBe(true);
  });

  it('has aria-describedby linking to error', () => {
    render(Input, {
      props: { error: 'Required' },
    });
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = document.getElementById(describedBy!);
    expect(errorEl).toHaveTextContent('Required');
  });
});
