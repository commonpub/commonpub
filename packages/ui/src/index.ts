// @commonpub/ui — Vue 3 component library

// Theme utilities
export {
  BUILT_IN_THEMES,
  TOKEN_NAMES,
  isValidThemeId,
  validateTokenOverrides,
  applyThemeToElement,
  getThemeFromElement,
} from './theme.js';
export type { ThemeDefinition } from './theme.js';

// Foundation components
export { default as VisuallyHidden } from './components/VisuallyHidden.vue';
export { default as Button } from './components/Button.vue';
export { default as IconButton } from './components/IconButton.vue';
export { default as Input } from './components/Input.vue';
export { default as Textarea } from './components/Textarea.vue';
export { default as Select } from './components/Select.vue';
export { default as Badge } from './components/Badge.vue';
export { default as Avatar } from './components/Avatar.vue';
export { default as Separator } from './components/Separator.vue';
export { default as Stack } from './components/Stack.vue';

// Compound components
export { default as Tooltip } from './components/Tooltip.vue';
export { default as Popover } from './components/Popover.vue';
export { default as Menu } from './components/Menu.vue';
export { default as MenuItem } from './components/MenuItem.vue';
export { default as Dialog } from './components/Dialog.vue';
export { default as Tabs } from './components/Tabs.vue';

// New components
export { default as Card } from './components/Card.vue';
export { default as Toggle } from './components/Toggle.vue';
export { default as TagInput } from './components/TagInput.vue';
export { default as ProgressBar } from './components/ProgressBar.vue';
export { default as Alert } from './components/Alert.vue';
export { default as Toolbar } from './components/Toolbar.vue';
