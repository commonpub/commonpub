# @commonpub/ui

> Headless Vue 3 components and theme utilities with base theme (light/dark) and CSS custom property tokens.

**npm**: `@commonpub/ui`
**Source**: `packages/ui/src/`
**Entry**: `packages/ui/src/index.ts`

---

## Exports

### Theme Utilities

| Export | Kind | Description |
|--------|------|-------------|
| `BUILT_IN_THEMES` | `ThemeDefinition[]` | Array of 3 built-in theme definitions (base, dark, generics) |
| `TOKEN_NAMES` | `string[]` | Array of 136 valid CSS token names |
| `isValidThemeId` | Function | Validates a theme ID string |
| `validateTokenOverrides` | Function | Validates token override keys |
| `applyThemeToElement` | Function | Applies theme + overrides to a DOM element |
| `getThemeFromElement` | Function | Reads current theme from a DOM element |
| `ThemeDefinition` | Type | `{ id, name, description, isDark }` |

See [Theming Guide](../guides/theming.md) for complete token reference.

### Components (15)

| Export | Component | Description |
|--------|-----------|-------------|
| `Button` | `Button.vue` | Button with variants, sizes, loading state |
| `IconButton` | `IconButton.vue` | Icon-only button with aria-label |
| `Input` | `Input.vue` | Text input with label, error, hint |
| `Textarea` | `Textarea.vue` | Multi-line text input |
| `Select` | `Select.vue` | Dropdown select with options |
| `Tooltip` | `Tooltip.vue` | Hover/focus tooltip |
| `Popover` | `Popover.vue` | Click-triggered popover |
| `Menu` | `Menu.vue` | Dropdown menu container |
| `MenuItem` | `MenuItem.vue` | Individual menu item |
| `Dialog` | `Dialog.vue` | Modal dialog with backdrop |
| `Tabs` | `Tabs.vue` | Tab panel interface |
| `Badge` | `Badge.vue` | Status/label badge |
| `Avatar` | `Avatar.vue` | User avatar with fallback |
| `Stack` | `Stack.vue` | Flex layout utility |
| `Separator` | `Separator.vue` | Visual divider |
| `VisuallyHidden` | `VisuallyHidden.vue` | Screen-reader-only text |

---

## Component Standards

All components follow these conventions (from CLAUDE.md):

- **Headless**: Structure and behavior only, styled via CSS custom properties
- **`class` prop**: Every component accepts a `class` prop for external styling
- **Keyboard navigable**: All interactive elements support keyboard interaction
- **ARIA labels**: All interactive elements have appropriate ARIA attributes
- **WCAG 2.1 AA**: Minimum contrast and sizing requirements met
- **Vue 3 Composition API**: Uses `ref`, `computed`, `watch` syntax with `<script setup lang="ts">`
- **No hardcoded colors/fonts**: All visual properties use `var(--token-name)`

---

## Component API Reference

### `Button`

```vue
<template>
  <Button
    variant="primary|secondary|ghost|danger"
    size="sm|md|lg"
    :disabled="false"
    :loading="false"
    type="button|submit|reset"
    class=""
    @click="handler"
  >
    Button text
  </Button>
</template>
```

### `IconButton`

```vue
<template>
  <IconButton
    label="Close"
    variant="ghost|primary|secondary|danger"
    size="sm|md|lg"
    :disabled="false"
    class=""
    @click="handler"
  >
    <IconComponent />
  </IconButton>
</template>
```

### `Input`

```vue
<template>
  <Input
    name="field"
    label="Field Label"
    type="text|email|password|number|url"
    v-model="value"
    placeholder=""
    error="Error message"
    hint="Help text"
    :required="false"
    :disabled="false"
    class=""
  />
</template>
```

### `Textarea`

```vue
<template>
  <Textarea
    name="content"
    label="Content"
    v-model="value"
    placeholder=""
    :rows="4"
    error=""
    hint=""
    :required="false"
    :disabled="false"
    class=""
  />
</template>
```

### `Select`

```vue
<template>
  <Select
    name="option"
    label="Choose"
    v-model="value"
    :options="[{ value: 'a', label: 'Option A' }]"
    error=""
    :required="false"
    :disabled="false"
    class=""
  />
</template>
```

### `Tooltip`

```vue
<template>
  <Tooltip text="Tooltip content" position="top|bottom|left|right">
    <span>Hover me</span>
  </Tooltip>
</template>
```

### `Popover`

```vue
<template>
  <Popover>
    <template #trigger>
      <Button>Open</Button>
    </template>
    <template #content>
      <div>Popover content</div>
    </template>
  </Popover>
</template>
```

### `Menu`

```vue
<template>
  <Menu>
    <template #trigger>
      <Button>Menu</Button>
    </template>
    <template #items>
      <MenuItem @click="action1">Action 1</MenuItem>
      <MenuItem @click="action2">Action 2</MenuItem>
      <Separator />
      <MenuItem @click="action3" variant="danger">Delete</MenuItem>
    </template>
  </Menu>
</template>
```

### `MenuItem`

```vue
<template>
  <MenuItem
    @click="handler"
    :disabled="false"
    variant="default|danger"
    class=""
  >
    Item label
  </MenuItem>
</template>
```

### `Dialog`

```vue
<template>
  <Dialog :open="isOpen" @close="handleClose" title="Dialog Title">
    <p>Dialog content</p>
    <template #footer>
      <Button @click="handleClose">Cancel</Button>
      <Button variant="primary" @click="handleConfirm">Confirm</Button>
    </template>
  </Dialog>
</template>
```

### `Tabs`

```vue
<template>
  <Tabs
    :tabs="[
      { id: 'tab1', label: 'Tab 1' },
      { id: 'tab2', label: 'Tab 2' },
    ]"
    active="tab1"
    @change="handleChange"
  >
    <template #panel="{ tab }">
      <div v-if="tab === 'tab1'">Tab 1 content</div>
      <div v-else>Tab 2 content</div>
    </template>
  </Tabs>
</template>
```

### `Badge`

```vue
<template>
  <Badge variant="default|success|warning|error|info" size="sm|md">
    Label
  </Badge>
</template>
```

### `Avatar`

```vue
<template>
  <Avatar
    src="/avatar.jpg"
    alt="User name"
    size="sm|md|lg|xl"
    fallback="UN"
    class=""
  />
</template>
```

### `Stack`

```vue
<template>
  <Stack direction="row|column" gap="sm|md|lg" align="start|center|end|stretch" class="">
    <div>Child 1</div>
    <div>Child 2</div>
  </Stack>
</template>
```

### `Separator`

```vue
<template>
  <Separator orientation="horizontal|vertical" class="" />
</template>
```

### `VisuallyHidden`

```vue
<template>
  <VisuallyHidden>Screen reader only text</VisuallyHidden>
</template>
```

---

## Internal Architecture

```
packages/ui/src/
├── index.ts                  → All exports
├── theme.ts                  → Theme definitions, TOKEN_NAMES, theme utilities
└── components/
    ├── Avatar.vue
    ├── Badge.vue
    ├── Button.vue
    ├── Dialog.vue
    ├── IconButton.vue
    ├── Input.vue
    ├── Menu.vue
    ├── MenuItem.vue
    ├── Popover.vue
    ├── Select.vue
    ├── Separator.vue
    ├── Stack.vue
    ├── Tabs.vue
    ├── Textarea.vue
    ├── Tooltip.vue
    └── VisuallyHidden.vue
```
