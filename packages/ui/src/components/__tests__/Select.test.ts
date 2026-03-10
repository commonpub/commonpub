import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import Select from '../Select.svelte';

const options = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

describe('Select', () => {
  it('renders with label and trigger', () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows placeholder text when no value selected', () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });
    expect(screen.getByRole('combobox')).toHaveTextContent('Select an option');
  });

  it('shows selected option label', () => {
    render(Select, { props: { id: 'color', label: 'Color', options, value: 'green' } });
    expect(screen.getByRole('combobox')).toHaveTextContent('Green');
  });

  it('opens listbox on click', async () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });
    const trigger = screen.getByRole('combobox');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects option on click', async () => {
    const handler = vi.fn();
    render(Select, { props: { id: 'color', label: 'Color', options, onchange: handler } });

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Blue' }));

    expect(handler).toHaveBeenCalledWith('blue');
  });

  it('closes on Escape', async () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });

    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates with arrow keys', async () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Active descendant should be first option
    expect(trigger).toHaveAttribute('aria-activedescendant', 'color-option-0');

    await userEvent.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', 'color-option-1');
  });

  it('selects with Enter', async () => {
    const handler = vi.fn();
    render(Select, { props: { id: 'color', label: 'Color', options, onchange: handler } });

    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(handler).toHaveBeenCalledWith('green');
  });

  it('navigates to first with Home', async () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });

    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Home}');

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      'color-option-0'
    );
  });

  it('navigates to last with End', async () => {
    render(Select, { props: { id: 'color', label: 'Color', options } });

    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{End}');

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      'color-option-2'
    );
  });

  it('displays error state', () => {
    render(Select, {
      props: { id: 'color', label: 'Color', options, error: 'Pick one' },
    });
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one');
  });

  it('can be disabled', () => {
    render(Select, { props: { id: 'color', label: 'Color', options, disabled: true } });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('accepts a class prop', () => {
    const { container } = render(Select, {
      props: { id: 'color', label: 'Color', options, class: 'custom' },
    });
    expect(container.querySelector('.snaplify-select')?.className).toContain('custom');
  });

  it('passes axe accessibility scan', async () => {
    const { container } = render(Select, {
      props: { id: 'color', label: 'Favorite Color', options },
    });
    await expectNoA11yViolations(container);
  });
});
