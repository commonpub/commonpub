import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Textarea from '../Textarea.vue';

describe('Textarea', () => {
  it('renders with a label', () => {
    render(Textarea, {
      props: { label: 'Description' },
    });
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('renders as a textarea element', () => {
    render(Textarea, {
      props: { label: 'Bio' },
    });
    const textarea = screen.getByLabelText('Bio');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('shows error message with role="alert"', () => {
    render(Textarea, {
      props: { label: 'Bio', error: 'Required field' },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required field');
  });

  it('sets aria-invalid when error is present', () => {
    render(Textarea, {
      props: { label: 'Bio', error: 'Too short' },
    });
    const textarea = screen.getByLabelText('Bio');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows hint text', () => {
    render(Textarea, {
      props: { label: 'Bio', hint: 'Max 500 characters' },
    });
    expect(screen.getByText('Max 500 characters')).toBeTruthy();
  });

  it('emits update:modelValue on input', async () => {
    const { emitted } = render(Textarea, {
      props: { label: 'Bio', modelValue: '' },
    });
    const textarea = screen.getByLabelText('Bio');
    await fireEvent.update(textarea, 'Hello world');
    expect(emitted()['update:modelValue']).toBeTruthy();
  });

  it('renders with provided modelValue', () => {
    render(Textarea, {
      props: { label: 'Bio', modelValue: 'Existing text' },
    });
    const textarea = screen.getByLabelText('Bio') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Existing text');
  });

  it('applies error class when error is present', () => {
    render(Textarea, {
      props: { label: 'Bio', error: 'Error' },
    });
    const wrapper = screen.getByLabelText('Bio').closest('.cpub-textarea-group');
    expect(wrapper?.classList.contains('cpub-textarea-group--error')).toBe(true);
  });
});
