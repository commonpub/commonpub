import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import MenuItem from '../MenuItem.vue';

describe('MenuItem', () => {
  it('has role="menuitem"', () => {
    render(MenuItem, {
      slots: { default: 'Edit' },
    });
    expect(screen.getByRole('menuitem')).toBeTruthy();
  });

  it('renders slot content', () => {
    render(MenuItem, {
      slots: { default: 'Delete item' },
    });
    expect(screen.getByRole('menuitem')).toHaveTextContent('Delete item');
  });

  it('has tabindex="0" when not disabled', () => {
    render(MenuItem, {
      slots: { default: 'Edit' },
    });
    expect(screen.getByRole('menuitem').getAttribute('tabindex')).toBe('0');
  });

  it('has tabindex="-1" when disabled', () => {
    render(MenuItem, {
      props: { disabled: true },
      slots: { default: 'Edit' },
    });
    const item = screen.getByRole('menuitem');
    expect(item.getAttribute('tabindex')).toBe('-1');
  });

  it('sets aria-disabled when disabled', () => {
    render(MenuItem, {
      props: { disabled: true },
      slots: { default: 'Edit' },
    });
    expect(screen.getByRole('menuitem').getAttribute('aria-disabled')).toBe('true');
  });

  it('applies disabled class when disabled', () => {
    render(MenuItem, {
      props: { disabled: true },
      slots: { default: 'Edit' },
    });
    expect(screen.getByRole('menuitem').classList.contains('cpub-menu-item--disabled')).toBe(true);
  });

  it('emits select on click', async () => {
    const { emitted } = render(MenuItem, {
      slots: { default: 'Edit' },
    });
    await fireEvent.click(screen.getByRole('menuitem'));
    expect(emitted()['select']).toBeTruthy();
  });

  it('does not emit select on click when disabled', async () => {
    const { emitted } = render(MenuItem, {
      props: { disabled: true },
      slots: { default: 'Edit' },
    });
    await fireEvent.click(screen.getByRole('menuitem'));
    expect(emitted()['select']).toBeFalsy();
  });

  it('emits select on Enter key', async () => {
    const { emitted } = render(MenuItem, {
      slots: { default: 'Edit' },
    });
    await fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'Enter' });
    expect(emitted()['select']).toBeTruthy();
  });

  it('emits select on Space key', async () => {
    const { emitted } = render(MenuItem, {
      slots: { default: 'Edit' },
    });
    await fireEvent.keyDown(screen.getByRole('menuitem'), { key: ' ' });
    expect(emitted()['select']).toBeTruthy();
  });
});
