import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Select from '../Select.vue';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select', () => {
  it('renders with a label', () => {
    render(Select, {
      props: { label: 'Choose one', options },
    });
    expect(screen.getByLabelText('Choose one')).toBeTruthy();
  });

  it('renders all options', () => {
    render(Select, {
      props: { label: 'Pick', options },
    });
    const select = screen.getByLabelText('Pick') as HTMLSelectElement;
    const renderedOptions = select.querySelectorAll('option');
    expect(renderedOptions.length).toBe(3);
    expect(renderedOptions[0]).toHaveTextContent('Option A');
    expect(renderedOptions[1]).toHaveTextContent('Option B');
    expect(renderedOptions[2]).toHaveTextContent('Option C');
  });

  it('shows error message with role="alert"', () => {
    render(Select, {
      props: { label: 'Pick', options, error: 'Selection required' },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Selection required');
  });

  it('sets aria-invalid when error is present', () => {
    render(Select, {
      props: { label: 'Pick', options, error: 'Required' },
    });
    const select = screen.getByLabelText('Pick');
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('emits update:modelValue on change', async () => {
    const { emitted } = render(Select, {
      props: { label: 'Pick', options, modelValue: 'a' },
    });
    const select = screen.getByLabelText('Pick');
    await fireEvent.update(select, 'b');
    expect(emitted()['update:modelValue']).toBeTruthy();
  });

  it('renders as a combobox element', () => {
    render(Select, {
      props: { label: 'Pick', options },
    });
    const select = screen.getByLabelText('Pick');
    expect(select.tagName).toBe('SELECT');
  });

  it('applies error class when error is present', () => {
    render(Select, {
      props: { label: 'Pick', options, error: 'Error' },
    });
    const wrapper = screen.getByLabelText('Pick').closest('.cpub-select-group');
    expect(wrapper?.classList.contains('cpub-select-group--error')).toBe(true);
  });
});
