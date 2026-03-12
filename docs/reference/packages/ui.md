# @commonpub/ui

> 15 headless Svelte 5 components and theme utilities with 4 built-in themes and 142 CSS tokens.

**npm**: `@commonpub/ui`
**Source**: `packages/ui/src/`
**Entry**: `packages/ui/src/index.ts`

---

## Exports

### Theme Utilities

| Export | Kind | Description |
|--------|------|-------------|
| `BUILT_IN_THEMES` | `ThemeDefinition[]` | Array of 4 built-in theme definitions |
| `TOKEN_NAMES` | `string[]` | Array of 142 valid CSS token names |
| `isValidThemeId` | Function | Validates a theme ID string |
| `validateTokenOverrides` | Function | Validates token override keys |
| `applyThemeToElement` | Function | Applies theme + overrides to a DOM element |
| `getThemeFromElement` | Function | Reads current theme from a DOM element |
| `ThemeDefinition` | Type | `{ id, name, description, isDark }` |

See [Theming Guide](../guides/theming.md) for complete token reference.

### Components (15)

| Export | Component | Description |
|--------|-----------|-------------|
| `Button` | `Button.svelte` | Button with variants, sizes, loading state |
| `IconButton` | `IconButton.svelte` | Icon-only button with aria-label |
| `Input` | `Input.svelte` | Text input with label, error, hint |
| `Textarea` | `Textarea.svelte` | Multi-line text input |
| `Select` | `Select.svelte` | Dropdown select with options |
| `Tooltip` | `Tooltip.svelte` | Hover/focus tooltip |
| `Popover` | `Popover.svelte` | Click-triggered popover |
| `Menu` | `Menu.svelte` | Dropdown menu container |
| `MenuItem` | `MenuItem.svelte` | Individual menu item |
| `Dialog` | `Dialog.svelte` | Modal dialog with backdrop |
| `Tabs` | `Tabs.svelte` | Tab panel interface |
| `Badge` | `Badge.svelte` | Status/label badge |
| `Avatar` | `Avatar.svelte` | User avatar with fallback |
| `Stack` | `Stack.svelte` | Flex layout utility |
| `Separator` | `Separator.svelte` | Visual divider |
| `VisuallyHidden` | `VisuallyHidden.svelte` | Screen-reader-only text |

---

## Component Standards

All components follow these conventions (from CLAUDE.md):

- **Headless**: Structure and behavior only, styled via CSS custom properties
- **`class` prop**: Every component accepts a `class` prop for external styling
- **Keyboard navigable**: All interactive elements support keyboard interaction
- **ARIA labels**: All interactive elements have appropriate ARIA attributes
- **WCAG 2.1 AA**: Minimum contrast and sizing requirements met
- **Svelte 5 runes**: Uses `$state`, `$derived`, `$effect` syntax
- **No hardcoded colors/fonts**: All visual properties use `var(--token-name)`

---

## Component API Reference

### `Button`

```svelte
<Button
  variant="primary|secondary|ghost|danger"
  size="sm|md|lg"
  disabled={false}
  loading={false}
  type="button|submit|reset"
  class=""
  onclick={handler}
>
  Button text
</Button>
```

### `IconButton`

```svelte
<IconButton
  label="Close"
  variant="ghost|primary|secondary|danger"
  size="sm|md|lg"
  disabled={false}
  class=""
  onclick={handler}
>
  <IconComponent />
</IconButton>
```

### `Input`

```svelte
<Input
  name="field"
  label="Field Label"
  type="text|email|password|number|url"
  value=""
  placeholder=""
  error="Error message"
  hint="Help text"
  required={false}
  disabled={false}
  class=""
/>
```

### `Textarea`

```svelte
<Textarea
  name="content"
  label="Content"
  value=""
  placeholder=""
  rows={4}
  error=""
  hint=""
  required={false}
  disabled={false}
  class=""
/>
```

### `Select`

```svelte
<Select
  name="option"
  label="Choose"
  value=""
  options={[{ value: 'a', label: 'Option A' }]}
  error=""
  required={false}
  disabled={false}
  class=""
/>
```

### `Tooltip`

```svelte
<Tooltip text="Tooltip content" position="top|bottom|left|right">
  <span>Hover me</span>
</Tooltip>
```

### `Popover`

```svelte
<Popover>
  {#snippet trigger()}
    <Button>Open</Button>
  {/snippet}
  {#snippet content()}
    <div>Popover content</div>
  {/snippet}
</Popover>
```

### `Menu`

```svelte
<Menu>
  {#snippet trigger()}
    <Button>Menu</Button>
  {/snippet}
  {#snippet items()}
    <MenuItem onclick={action1}>Action 1</MenuItem>
    <MenuItem onclick={action2}>Action 2</MenuItem>
    <Separator />
    <MenuItem onclick={action3} variant="danger">Delete</MenuItem>
  {/snippet}
</Menu>
```

### `MenuItem`

```svelte
<MenuItem
  onclick={handler}
  disabled={false}
  variant="default|danger"
  class=""
>
  Item label
</MenuItem>
```

### `Dialog`

```svelte
<Dialog open={isOpen} onclose={handleClose} title="Dialog Title">
  <p>Dialog content</p>
  {#snippet footer()}
    <Button onclick={handleClose}>Cancel</Button>
    <Button variant="primary" onclick={handleConfirm}>Confirm</Button>
  {/snippet}
</Dialog>
```

### `Tabs`

```svelte
<Tabs
  tabs={[
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
  ]}
  active="tab1"
  onchange={handleChange}
>
  {#snippet panel(tab)}
    {#if tab === 'tab1'}
      <div>Tab 1 content</div>
    {:else}
      <div>Tab 2 content</div>
    {/if}
  {/snippet}
</Tabs>
```

### `Badge`

```svelte
<Badge variant="default|success|warning|error|info" size="sm|md">
  Label
</Badge>
```

### `Avatar`

```svelte
<Avatar
  src="/avatar.jpg"
  alt="User name"
  size="sm|md|lg|xl"
  fallback="UN"
  class=""
/>
```

### `Stack`

```svelte
<Stack direction="row|column" gap="sm|md|lg" align="start|center|end|stretch" class="">
  <div>Child 1</div>
  <div>Child 2</div>
</Stack>
```

### `Separator`

```svelte
<Separator orientation="horizontal|vertical" class="" />
```

### `VisuallyHidden`

```svelte
<VisuallyHidden>Screen reader only text</VisuallyHidden>
```

---

## Internal Architecture

```
packages/ui/src/
├── index.ts                  → All exports
├── theme.ts                  → Theme definitions, TOKEN_NAMES, theme utilities
└── components/
    ├── Avatar.svelte
    ├── Badge.svelte
    ├── Button.svelte
    ├── Dialog.svelte
    ├── IconButton.svelte
    ├── Input.svelte
    ├── Menu.svelte
    ├── MenuItem.svelte
    ├── Popover.svelte
    ├── Select.svelte
    ├── Separator.svelte
    ├── Stack.svelte
    ├── Tabs.svelte
    ├── Textarea.svelte
    ├── Tooltip.svelte
    └── VisuallyHidden.svelte
```
