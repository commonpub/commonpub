import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Popover from '../Popover.vue';

const popoverSlots = {
  trigger: 'Open menu',
  content: 'Popover body',
};

describe('Popover', () => {
  it('renders trigger content', () => {
    render(Popover, { slots: popoverSlots });
    expect(screen.getByText('Open menu')).toBeTruthy();
  });

  it('trigger has role="button" and tabindex="0"', () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('tabindex')).toBe('0');
  });

  it('does not show dialog initially', () => {
    render(Popover, { slots: popoverSlots });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows dialog on trigger click', async () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    await fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Popover body')).toBeTruthy();
  });

  it('hides dialog on second click (toggle)', async () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    await fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape key', async () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    await fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on Enter key', async () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('opens on Space key', async () => {
    render(Popover, { slots: popoverSlots });
    const trigger = screen.getByRole('button');
    await fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
