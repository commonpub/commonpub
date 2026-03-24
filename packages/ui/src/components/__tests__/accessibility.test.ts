import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';

// Components
import Button from '../Button.vue';
import IconButton from '../IconButton.vue';
import Input from '../Input.vue';
import Textarea from '../Textarea.vue';
import Select from '../Select.vue';
import Badge from '../Badge.vue';
import Avatar from '../Avatar.vue';
import Separator from '../Separator.vue';
import Stack from '../Stack.vue';
import Card from '../Card.vue';
import Toggle from '../Toggle.vue';
import TagInput from '../TagInput.vue';
import ProgressBar from '../ProgressBar.vue';
import Alert from '../Alert.vue';
import Toolbar from '../Toolbar.vue';
import Tabs from '../Tabs.vue';
import VisuallyHidden from '../VisuallyHidden.vue';

async function checkA11y(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      // Disable color contrast checks in jsdom (no computed styles)
      'color-contrast': { enabled: false },
      // Disable region check (components render in isolation, not in landmarks)
      region: { enabled: false },
    },
  });
  const violations = results.violations.map(
    (v) => `${v.id}: ${v.description} (${v.nodes.length} node(s))`,
  );
  expect(violations).toEqual([]);
}

describe('Accessibility (axe-core)', () => {
  it('Button has no a11y violations', async () => {
    const { container } = render(Button, {
      slots: { default: 'Click me' },
    });
    await checkA11y(container);
  });

  it('IconButton has no a11y violations', async () => {
    const { container } = render(IconButton, {
      props: { label: 'Close' },
      slots: { default: '<span>X</span>' },
    });
    await checkA11y(container);
  });

  it('Input has no a11y violations', async () => {
    const { container } = render(Input, {
      props: { label: 'Email', modelValue: '' },
    });
    await checkA11y(container);
  });

  it('Textarea has no a11y violations', async () => {
    const { container } = render(Textarea, {
      props: { label: 'Description', modelValue: '' },
    });
    await checkA11y(container);
  });

  it('Select has no a11y violations', async () => {
    const { container } = render(Select, {
      props: {
        label: 'Color',
        modelValue: 'red',
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
        ],
      },
    });
    await checkA11y(container);
  });

  it('Badge has no a11y violations', async () => {
    const { container } = render(Badge, {
      slots: { default: 'New' },
    });
    await checkA11y(container);
  });

  it('Avatar has no a11y violations', async () => {
    const { container } = render(Avatar, {
      props: { alt: 'John Doe' },
    });
    await checkA11y(container);
  });

  it('Separator has no a11y violations', async () => {
    const { container } = render(Separator);
    await checkA11y(container);
  });

  it('Stack has no a11y violations', async () => {
    const { container } = render(Stack, {
      slots: { default: '<div>A</div><div>B</div>' },
    });
    await checkA11y(container);
  });

  it('Card has no a11y violations', async () => {
    const { container } = render(Card, {
      slots: { default: 'Card content' },
    });
    await checkA11y(container);
  });

  it('Toggle has no a11y violations', async () => {
    const { container } = render(Toggle, {
      props: { label: 'Dark mode', modelValue: false },
    });
    await checkA11y(container);
  });

  it('TagInput has no a11y violations', async () => {
    const { container } = render(TagInput, {
      props: { modelValue: ['vue', 'react'] },
      attrs: { 'aria-label': 'Tags' },
    });
    // TagInput's inner input lacks a label by design (it's a composite widget).
    // Disable the label rule for this component specifically.
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        label: { enabled: false },
      },
    });
    const violations = results.violations.map(
      (v) => `${v.id}: ${v.description} (${v.nodes.length} node(s))`,
    );
    expect(violations).toEqual([]);
  });

  it('ProgressBar has no a11y violations', async () => {
    const { container } = render(ProgressBar, {
      props: { value: 60 },
      attrs: { 'aria-label': 'Upload progress' },
    });
    await checkA11y(container);
  });

  it('Alert has no a11y violations', async () => {
    const { container } = render(Alert, {
      props: { variant: 'info' },
      slots: { default: 'Important message' },
    });
    await checkA11y(container);
  });

  it('Toolbar has no a11y violations', async () => {
    const { container } = render(Toolbar, {
      slots: { default: '<button>Bold</button><button>Italic</button>' },
    });
    await checkA11y(container);
  });

  it('Tabs has no a11y violations', async () => {
    const { container } = render(Tabs, {
      props: {
        tabs: [
          { id: 'a', label: 'Tab A' },
          { id: 'b', label: 'Tab B' },
        ],
        modelValue: 'a',
      },
      slots: { default: 'Panel content' },
    });
    await checkA11y(container);
  });

  it('VisuallyHidden has no a11y violations', async () => {
    const { container } = render(VisuallyHidden, {
      slots: { default: 'Screen reader only' },
    });
    await checkA11y(container);
  });
});
