import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Menu from '../Menu.vue';
import MenuItem from '../MenuItem.vue';
import { h } from 'vue';

function renderMenu() {
  return render(Menu, {
    slots: {
      trigger: 'Menu trigger',
      default: () => [
        h(MenuItem, null, { default: () => 'Item 1' }),
        h(MenuItem, null, { default: () => 'Item 2' }),
        h(MenuItem, null, { default: () => 'Item 3' }),
      ],
    },
  });
}

describe('Menu', () => {
  it('renders trigger content', () => {
    renderMenu();
    expect(screen.getByText('Menu trigger')).toBeTruthy();
  });

  it('does not show menu initially', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens menu on trigger click with role="menu"', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('renders menu items inside menu', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(3);
  });

  it('closes menu on Escape key', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    const wrapper = trigger.closest('.cpub-menu-wrapper')!;
    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('navigates items with ArrowDown', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);

    const items = screen.getAllByRole('menuitem');
    items[0].focus();

    const wrapper = trigger.closest('.cpub-menu-wrapper')!;
    await fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('navigates items with ArrowUp', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);

    const items = screen.getAllByRole('menuitem');
    items[1].focus();

    const wrapper = trigger.closest('.cpub-menu-wrapper')!;
    await fireEvent.keyDown(wrapper, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('wraps ArrowDown from last to first item', async () => {
    renderMenu();
    const trigger = screen.getByText('Menu trigger');
    await fireEvent.click(trigger);

    const items = screen.getAllByRole('menuitem');
    items[2].focus();

    const wrapper = trigger.closest('.cpub-menu-wrapper')!;
    await fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });
});
