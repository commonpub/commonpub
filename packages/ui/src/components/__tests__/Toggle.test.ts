import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Toggle from '../Toggle.vue';

describe('Toggle', () => {
  it('has role="switch"', () => {
    render(Toggle);
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('has aria-checked="false" by default', () => {
    render(Toggle);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('has aria-checked="true" when modelValue is true', () => {
    render(Toggle, {
      props: { modelValue: true },
    });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('emits update:modelValue with toggled value on click', async () => {
    const { emitted } = render(Toggle, {
      props: { modelValue: false },
    });
    await fireEvent.click(screen.getByRole('switch'));
    expect(emitted()['update:modelValue']).toEqual([[true]]);
  });

  it('emits false when toggling from true', async () => {
    const { emitted } = render(Toggle, {
      props: { modelValue: true },
    });
    await fireEvent.click(screen.getByRole('switch'));
    expect(emitted()['update:modelValue']).toEqual([[false]]);
  });

  it('renders label text when provided', () => {
    render(Toggle, {
      props: { label: 'Dark mode' },
    });
    expect(screen.getByText('Dark mode')).toBeTruthy();
  });

  it('sets aria-label on the switch button', () => {
    render(Toggle, {
      props: { label: 'Notifications' },
    });
    expect(screen.getByRole('switch').getAttribute('aria-label')).toBe('Notifications');
  });

  it('applies cpub-toggle--on class when on', () => {
    render(Toggle, {
      props: { modelValue: true },
    });
    expect(screen.getByRole('switch').classList.contains('cpub-toggle--on')).toBe(true);
  });
});
