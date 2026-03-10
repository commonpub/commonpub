import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../test-helpers';
import MenuItem from '../MenuItem.svelte';

describe('MenuItem', () => {
  it('renders with role=menuitem', () => {
    render(MenuItem, { props: { label: 'Copy' } });
    expect(screen.getByRole('menuitem')).toHaveTextContent('Copy');
  });

  it('fires onclick handler', async () => {
    const handler = vi.fn();
    render(MenuItem, { props: { label: 'Paste', onclick: handler } });
    await userEvent.click(screen.getByRole('menuitem'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('fires onclick on Enter key', async () => {
    const handler = vi.fn();
    render(MenuItem, { props: { label: 'Cut', onclick: handler } });
    const item = screen.getByRole('menuitem');
    item.focus();
    await userEvent.keyboard('{Enter}');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('fires onclick on Space key', async () => {
    const handler = vi.fn();
    render(MenuItem, { props: { label: 'Delete', onclick: handler } });
    const item = screen.getByRole('menuitem');
    item.focus();
    await userEvent.keyboard(' ');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('can be disabled', () => {
    render(MenuItem, { props: { label: 'Disabled', disabled: true } });
    expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not fire onclick when disabled', async () => {
    const handler = vi.fn();
    render(MenuItem, { props: { label: 'Disabled', disabled: true, onclick: handler } });
    await userEvent.click(screen.getByRole('menuitem'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts a class prop', () => {
    render(MenuItem, { props: { label: 'Item', class: 'custom' } });
    expect(screen.getByRole('menuitem').className).toContain('custom');
  });
});
