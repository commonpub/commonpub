import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import Tabs from '../Tabs.vue';
import Dialog from '../Dialog.vue';
import Menu from '../Menu.vue';
import Toggle from '../Toggle.vue';

const testTabs = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

describe('Tabs keyboard navigation', () => {
  it('ArrowRight moves to next tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'one' },
    });

    const firstTab = screen.getAllByRole('tab')[0]!;
    await fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    expect(emitted()['update:modelValue']![0]).toEqual(['two']);
  });

  it('ArrowLeft moves to previous tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'two' },
    });

    const secondTab = screen.getAllByRole('tab')[1]!;
    await fireEvent.keyDown(secondTab, { key: 'ArrowLeft' });
    expect(emitted()['update:modelValue']![0]).toEqual(['one']);
  });

  it('ArrowRight wraps from last to first tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'three' },
    });

    const lastTab = screen.getAllByRole('tab')[2]!;
    await fireEvent.keyDown(lastTab, { key: 'ArrowRight' });
    expect(emitted()['update:modelValue']![0]).toEqual(['one']);
  });

  it('ArrowLeft wraps from first to last tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'one' },
    });

    const firstTab = screen.getAllByRole('tab')[0]!;
    await fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });
    expect(emitted()['update:modelValue']![0]).toEqual(['three']);
  });

  it('Home key moves to first tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'three' },
    });

    const lastTab = screen.getAllByRole('tab')[2]!;
    await fireEvent.keyDown(lastTab, { key: 'Home' });
    expect(emitted()['update:modelValue']![0]).toEqual(['one']);
  });

  it('End key moves to last tab', async () => {
    const { emitted } = render(Tabs, {
      props: { tabs: testTabs, modelValue: 'one' },
    });

    const firstTab = screen.getAllByRole('tab')[0]!;
    await fireEvent.keyDown(firstTab, { key: 'End' });
    expect(emitted()['update:modelValue']![0]).toEqual(['three']);
  });
});

describe('Dialog keyboard handling', () => {
  it('Escape closes the dialog', async () => {
    const { emitted } = render(Dialog, {
      props: { open: true, title: 'Test' },
      slots: { default: 'Content' },
    });

    const backdrop = document.querySelector('.cpub-dialog-backdrop')!;
    await fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(emitted()['update:open']).toEqual([[false]]);
  });

  it('dialog has role and aria-modal', () => {
    render(Dialog, {
      props: { open: true, title: 'Test' },
      slots: { default: 'Content' },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Test');
  });
});

describe('Menu keyboard handling', () => {
  it('Enter opens menu', async () => {
    render(Menu, {
      slots: {
        trigger: '<button>Open menu</button>',
        default: '<div role="menuitem" tabindex="0">Item 1</div>',
      },
    });

    const trigger = screen.getByText('Open menu');
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('Space opens menu', async () => {
    render(Menu, {
      slots: {
        trigger: '<button>Open menu</button>',
        default: '<div role="menuitem" tabindex="0">Item 1</div>',
      },
    });

    const trigger = screen.getByText('Open menu');
    await fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('click toggles menu', async () => {
    render(Menu, {
      slots: {
        trigger: '<button>Open menu</button>',
        default: '<div role="menuitem" tabindex="0">Item 1</div>',
      },
    });

    const trigger = screen.getByText('Open menu');
    await fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    await fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Toggle keyboard handling', () => {
  it('click toggles the switch', async () => {
    const { emitted } = render(Toggle, {
      props: { label: 'Dark mode', modelValue: false },
    });

    const toggle = screen.getByRole('switch');
    await fireEvent.click(toggle);
    expect(emitted()['update:modelValue']![0]).toEqual([true]);
  });

  it('has correct aria-checked attribute', () => {
    render(Toggle, {
      props: { label: 'Notifications', modelValue: true },
    });

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('aria-checked reflects false state', () => {
    render(Toggle, {
      props: { label: 'Notifications', modelValue: false },
    });

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
