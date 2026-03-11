export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
}

export const BUILT_IN_THEMES: ThemeDefinition[] = [
  {
    id: 'generics',
    name: 'Generics',
    description: 'Dark minimal theme with blue accent',
    isDark: true,
  },
  { id: 'base', name: 'Base', description: 'Clean default theme with blue accents', isDark: false },
  {
    id: 'deepwood',
    name: 'Deepwood',
    description: 'Forest greens, lime accent, nature-inspired',
    isDark: true,
  },
  {
    id: 'hackbuild',
    name: 'hack.build',
    description: 'Punk zine theme, paper textures, hard-edge shadows',
    isDark: false,
  },
  {
    id: 'deveco',
    name: 'deveco.io',
    description: 'Clean tech, teal/pink/yellow accents',
    isDark: false,
  },
];

const THEME_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));

export function isValidThemeId(id: string): boolean {
  return THEME_IDS.has(id);
}

export const TOKEN_NAMES: string[] = [
  // Surface
  'color-surface',
  'color-surface-alt',
  'color-surface-raised',
  'color-surface-overlay',
  // Text
  'color-text',
  'color-text-secondary',
  'color-text-muted',
  'color-text-inverse',
  // Brand
  'color-primary',
  'color-primary-hover',
  'color-primary-text',
  // Accent
  'color-accent',
  'color-accent-hover',
  'color-accent-text',
  // Semantic
  'color-success',
  'color-warning',
  'color-error',
  'color-info',
  // Borders
  'color-border',
  'color-border-strong',
  'color-border-focus',
  // Interactive
  'color-link',
  'color-link-hover',
  // Typography
  'font-heading',
  'font-body',
  'font-mono',
  // Font sizes
  'text-xs',
  'text-sm',
  'text-base',
  'text-md',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'text-6xl',
  // Font weights
  'font-weight-normal',
  'font-weight-medium',
  'font-weight-semibold',
  'font-weight-bold',
  // Line heights
  'leading-tight',
  'leading-snug',
  'leading-normal',
  'leading-relaxed',
  // Spacing
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-8',
  'space-10',
  'space-12',
  'space-16',
  'space-20',
  'space-24',
  // Borders
  'border-width-thin',
  'border-width-default',
  'border-width-thick',
  'radius-none',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
  'radius-2xl',
  'radius-full',
  // Shadows
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  // Transitions
  'transition-fast',
  'transition-default',
  'transition-slow',
  // Z-index
  'z-dropdown',
  'z-sticky',
  'z-fixed',
  'z-modal-backdrop',
  'z-modal',
  'z-toast',
  'z-tooltip',
  // Layout
  'nav-height',
  'subnav-height',
  'sidebar-width',
  'content-max-width',
  'content-wide-max-width',
  // Focus
  'focus-ring',
];

const TOKEN_SET = new Set(TOKEN_NAMES);

export function validateTokenOverrides(overrides: Record<string, string>): {
  valid: Record<string, string>;
  invalid: string[];
} {
  const valid: Record<string, string> = {};
  const invalid: string[] = [];

  for (const key of Object.keys(overrides)) {
    if (TOKEN_SET.has(key)) {
      valid[key] = overrides[key]!;
    } else {
      invalid.push(key);
    }
  }

  return { valid, invalid };
}

export function applyThemeToElement(
  el: HTMLElement,
  themeId: string,
  overrides?: Record<string, string>,
): void {
  if (themeId === 'base') {
    el.removeAttribute('data-theme');
  } else {
    el.setAttribute('data-theme', themeId);
  }

  // Clear any previous inline overrides
  for (const token of TOKEN_NAMES) {
    el.style.removeProperty(`--${token}`);
  }

  // Apply overrides as inline CSS custom properties
  if (overrides) {
    const { valid } = validateTokenOverrides(overrides);
    for (const [key, value] of Object.entries(valid)) {
      el.style.setProperty(`--${key}`, value);
    }
  }
}

export function getThemeFromElement(el: HTMLElement): {
  themeId: string;
  overrides: Record<string, string>;
} {
  const themeId = el.getAttribute('data-theme') ?? 'base';
  const overrides: Record<string, string> = {};

  for (const token of TOKEN_NAMES) {
    const value = el.style.getPropertyValue(`--${token}`);
    if (value) {
      overrides[token] = value;
    }
  }

  return { themeId, overrides };
}
