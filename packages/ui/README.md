# @commonpub/ui

Headless Vue 3 component library with CSS custom property theming.

## Overview

Accessible, headless UI components built with Vue 3 Composition API (`<script setup lang="ts">`). Components define structure and behavior only. All visual styling is controlled via CSS custom properties (`var(--*)`). Zero hardcoded colors or fonts.

Includes 4 built-in theme CSS files and a theming API for runtime theme switching with inline token overrides.

## Installation

```bash
pnpm add @commonpub/ui
```

## Components

| Component        | Description                                    | Key Features                           |
| ---------------- | ---------------------------------------------- | -------------------------------------- |
| `Button`         | Interactive button with variants               | Loading state, disabled, keyboard      |
| `IconButton`     | Icon-only button with tooltip                  | ARIA label required                    |
| `Input`          | Text input with label and error                | Validation feedback                    |
| `Textarea`       | Multi-line text input                          | Auto-resize option                     |
| `Select`         | Dropdown select                                | Keyboard navigable                     |
| `Tooltip`        | Hover/focus tooltip                            | Accessible, auto-positioned            |
| `Popover`        | Floating content panel                         | Click-outside dismiss, focus trap      |
| `Menu`           | Dropdown menu trigger                          | Keyboard nav, roving tabindex          |
| `MenuItem`       | Menu item                                      | Active/disabled states                 |
| `Dialog`         | Modal dialog                                   | Focus trap, Escape to close            |
| `Tabs`           | Tabbed interface                               | ARIA tablist, keyboard arrows          |
| `Badge`          | Status/count badge                             | Variants: default, success, warning    |
| `Avatar`         | User avatar                                    | Image with initials fallback           |
| `Stack`          | Flex layout container                          | Direction, gap, alignment              |
| `Separator`      | Visual divider                                 | Horizontal/vertical, ARIA separator    |
| `Card`           | Content card container                         | Header, body, footer slots             |
| `Toggle`         | Toggle switch                                  | On/off state, ARIA switch              |
| `TagInput`       | Tag input with chips                           | Add/remove tags, keyboard support      |
| `ProgressBar`    | Progress indicator                             | Percentage, label, ARIA progressbar    |
| `Alert`          | Alert/banner message                           | Variants: info, success, warning, error|
| `Toolbar`        | Toolbar container                              | Horizontal/vertical, ARIA toolbar      |
| `VisuallyHidden` | Screen reader-only text                        | Accessibility utility                  |

## Usage

```vue
<script setup lang="ts">
import { Button, Input, Dialog, Tabs } from '@commonpub/ui';

const name = ref('');
const nameError = ref('');
const showModal = ref(false);
</script>

<template>
  <Button @click="handleClick" variant="primary">
    Save Project
  </Button>

  <Input
    v-model="name"
    label="Project Name"
    :error="nameError"
  />

  <Dialog v-model:open="showModal" title="Confirm Delete">
    <p>Are you sure you want to delete this project?</p>
  </Dialog>
</template>
```

All components accept a `class` prop for external styling:

```vue
<Button class="my-custom-button">Click me</Button>
```

## Theming

### Built-in Themes

| Theme       | ID          | Description                                |
| ----------- | ----------- | ------------------------------------------ |
| Base        | `base`      | Clean default theme with blue accents      |
| Deepwood    | `deepwood`  | Dark theme with forest greens, lime accent |
| hack.build  | `hackbuild` | Punk zine, paper textures, hard-edge       |
| deveco.io   | `deveco`    | Clean tech, teal/pink/yellow accents       |

### Importing Theme CSS

```ts
// Import a specific theme
import '@commonpub/ui/theme/base.css';
import '@commonpub/ui/theme/deepwood.css';
```

### Runtime Theme Switching

```ts
import { applyThemeToElement, getThemeFromElement, isValidThemeId } from '@commonpub/ui';

// Apply theme via data-theme attribute
applyThemeToElement(document.documentElement, 'deepwood');

// Apply with custom token overrides
applyThemeToElement(document.documentElement, 'base', {
  'color-primary': '#ff6600',
  'font-heading': '"Custom Font", sans-serif',
});

// Read current theme
const { themeId, overrides } = getThemeFromElement(document.documentElement);
```

### Token Contract

The full token surface is defined in `theme/base.css`. All tokens are CSS custom properties:

- **Surface colors**: `--color-surface`, `--color-surface-alt`, `--color-surface-raised`
- **Text colors**: `--color-text`, `--color-text-secondary`, `--color-text-muted`
- **Brand colors**: `--color-primary`, `--color-accent` (with hover and text variants)
- **Semantic colors**: `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- **Typography**: `--font-heading`, `--font-body`, `--font-mono`, sizes, weights, line heights
- **Spacing**: `--space-1` through `--space-24`
- **Borders**: Widths, radii (`--radius-sm` through `--radius-full`)
- **Shadows**: `--shadow-sm` through `--shadow-xl`
- **Z-index**: `--z-dropdown`, `--z-modal`, `--z-toast`, `--z-tooltip`
- **Layout**: `--nav-height`, `--sidebar-width`, `--content-max-width`

### Validating Token Overrides

```ts
import { validateTokenOverrides, TOKEN_NAMES } from '@commonpub/ui';

const { valid, invalid } = validateTokenOverrides({
  'color-primary': '#ff0000',   // valid
  'not-a-token': 'value',       // invalid
});
```

## Accessibility

All components meet WCAG 2.1 AA:

- Keyboard navigable (Tab, Enter, Space, Escape, Arrow keys)
- ARIA attributes on all interactive elements
- Focus indicators with `--focus-ring` token
- `prefers-reduced-motion` respected
- All components tested with axe-core

## Component Standards

- **Headless**: Structure and behavior only, no visual opinions
- **`class` prop**: Every component accepts `class` for external styling
- **Vue 3 Composition API**: `<script setup lang="ts">` syntax
- **Events**: Use Vue emit pattern

## Development

```bash
pnpm build        # Build with vite-plugin-vue
pnpm test         # Run tests (including axe-core a11y)
pnpm typecheck    # Type-check with vue-tsc
```

## Dependencies

- `vue` (peer): Vue 3.4+
