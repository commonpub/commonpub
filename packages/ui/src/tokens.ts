/**
 * Design-token registry — the single source of truth for what CSS custom
 * properties CommonPub recognizes, what category each belongs to, and what
 * input control the theme editor should render for it.
 *
 * Adding a new token:
 *   1. Add the CSS variable to `theme/base.css` (and any family overrides).
 *   2. Add a `TokenSpec` entry below.
 *   3. (Optional) If it's a new category, add to `TokenGroup`,
 *      `TOKEN_GROUP_LABELS`, and `TOKEN_GROUP_ORDER`.
 *
 * The editor reads this file via `tokensByGroup()` and renders one
 * `<AdminThemeTokenInput>` per entry — no editor-side changes needed.
 */

// ---- Spec types --------------------------------------------------------

export interface TokenSpec {
  /** Token name without the leading `--`. */
  key: string;
  /** Group it appears under in the editor. */
  group: TokenGroup;
  /** Input control to render. */
  kind: TokenKind;
  /** Optional one-line description shown in the editor. */
  description?: string;
  /** Default value (matches base.css). Used as the "reset" target + the
   *  baseline against which the discovery diff is computed. */
  default: string;
}

export type TokenGroup =
  | 'surfaces'
  | 'text'
  | 'borders'
  | 'accent'
  | 'semantic'
  | 'code'
  | 'typography'
  | 'spacing'
  | 'shape'
  | 'shadow'
  | 'treatment'
  | 'motion'
  | 'layout'
  | 'chrome'
  | 'z-index';

export type TokenKind =
  | 'color'
  | 'length'
  | 'number'
  | 'font-family'
  | 'font-weight'
  | 'shadow'
  | 'transition'
  | 'string';

// ---- Canonical token registry ------------------------------------------

export const TOKEN_SPECS: TokenSpec[] = [
  // Surfaces
  { key: 'bg', group: 'surfaces', kind: 'color', default: '#fafaf9', description: 'Page background' },
  { key: 'surface', group: 'surfaces', kind: 'color', default: '#ffffff', description: 'Card / panel background' },
  { key: 'surface2', group: 'surfaces', kind: 'color', default: '#f4f4f2', description: 'Subtle alt surface (input bg, hover)' },
  { key: 'surface3', group: 'surfaces', kind: 'color', default: '#eaeae7', description: 'Deeper alt surface' },
  // Overlay / scrim literals (modal backdrops, sticky-bar scrim, badge overlay).
  // Promoted from aliases so a forked/captured theme keeps them.
  { key: 'color-surface-overlay', group: 'surfaces', kind: 'color', default: 'rgba(0, 0, 0, 0.5)', description: 'Modal backdrop' },
  { key: 'color-surface-overlay-light', group: 'surfaces', kind: 'color', default: 'rgba(0, 0, 0, 0.4)', description: 'Lighter backdrop' },
  { key: 'color-surface-scrim', group: 'surfaces', kind: 'color', default: 'rgba(250, 250, 249, 0.75)', description: 'Sticky-bar scrim' },
  { key: 'color-badge-overlay', group: 'surfaces', kind: 'color', default: 'rgba(0, 0, 0, 0.75)', description: 'Badge overlay' },
  // Film-grain overlay opacity (0 = off). A global noise layer in app.vue reads this.
  { key: 'grain', group: 'surfaces', kind: 'number', default: '0', description: 'Film-grain overlay opacity (0 = off, ~0.03 subtle)' },

  // Text
  { key: 'text', group: 'text', kind: 'color', default: '#1a1a1a', description: 'Primary body text' },
  { key: 'text-dim', group: 'text', kind: 'color', default: '#6b6b66', description: 'Secondary text' },
  { key: 'text-faint', group: 'text', kind: 'color', default: '#a3a39e', description: 'Tertiary text / placeholders' },
  { key: 'color-text-inverse', group: 'text', kind: 'color', default: '#ffffff', description: 'Text on accent backgrounds' },

  // Borders
  { key: 'border', group: 'borders', kind: 'color', default: '#1a1a1a', description: 'Strong border (cards, buttons)' },
  { key: 'border2', group: 'borders', kind: 'color', default: '#d4d4d0', description: 'Soft border (dividers)' },

  // Accent
  { key: 'accent', group: 'accent', kind: 'color', default: '#5b9cf6', description: 'Primary brand accent' },
  { key: 'accent-bg', group: 'accent', kind: 'color', default: 'rgba(91, 156, 246, 0.08)', description: 'Accent tinted surface' },
  { key: 'accent-border', group: 'accent', kind: 'color', default: 'rgba(91, 156, 246, 0.25)' },
  { key: 'color-primary-hover', group: 'accent', kind: 'color', default: '#4a8be5', description: 'Accent hover state' },
  { key: 'color-on-accent', group: 'accent', kind: 'color', default: '#ffffff', description: 'Text on accent fills' },
  { key: 'color-link', group: 'accent', kind: 'color', default: '#5b9cf6' },
  { key: 'color-link-hover', group: 'accent', kind: 'color', default: '#4a8be5' },
  // Accent tints + states — literal values a theme must override (var() aliases
  // self-heal via base, these don't). Promoted from aliases so fork/capture
  // reproduce them instead of falling back to the base blue.
  { key: 'color-accent-hover', group: 'accent', kind: 'color', default: '#4a8be5', description: 'Accent fill hover' },
  { key: 'accent-bg-strong', group: 'accent', kind: 'color', default: 'rgba(91, 156, 246, 0.2)', description: 'Stronger accent tint' },
  { key: 'accent-bg-heavy', group: 'accent', kind: 'color', default: 'rgba(91, 156, 246, 0.4)', description: 'Heavy accent tint' },
  { key: 'accent-bg-solid', group: 'accent', kind: 'color', default: 'rgba(91, 156, 246, 0.6)', description: 'Near-solid accent tint' },
  { key: 'accent-focus-ring', group: 'accent', kind: 'shadow', default: '0 0 0 3px rgba(91, 156, 246, 0.12)', description: 'Accent focus glow' },
  { key: 'color-on-primary', group: 'accent', kind: 'color', default: '#ffffff', description: 'Text on primary fills' },
  { key: 'color-primary-text', group: 'accent', kind: 'color', default: '#ffffff', description: 'Text on primary buttons' },
  { key: 'color-accent-text', group: 'accent', kind: 'color', default: '#ffffff', description: 'Text on accent fills' },
  // Secondary accent — a second brand color for secondary CTAs (.cpub-btn-secondary)
  // + accents. Defaults to a violet so existing themes get a sensible second hue.
  { key: 'secondary', group: 'accent', kind: 'color', default: '#8b5cf6', description: 'Secondary brand accent' },
  { key: 'secondary-hover', group: 'accent', kind: 'color', default: '#7c3aed', description: 'Secondary accent hover' },
  { key: 'secondary-bg', group: 'accent', kind: 'color', default: 'rgba(139, 92, 246, 0.08)', description: 'Secondary tinted surface' },
  { key: 'secondary-border', group: 'accent', kind: 'color', default: 'rgba(139, 92, 246, 0.25)' },
  { key: 'color-on-secondary', group: 'accent', kind: 'color', default: '#ffffff', description: 'Text on secondary fills' },

  // Semantic colors
  { key: 'green', group: 'semantic', kind: 'color', default: '#22c55e' },
  { key: 'yellow', group: 'semantic', kind: 'color', default: '#f59e0b' },
  { key: 'red', group: 'semantic', kind: 'color', default: '#ef4444' },
  { key: 'purple', group: 'semantic', kind: 'color', default: '#8b5cf6' },
  { key: 'teal', group: 'semantic', kind: 'color', default: '#14b8a6' },
  { key: 'pink', group: 'semantic', kind: 'color', default: '#ec4899' },
  // Semantic tints — literal bg/border fills per status color. Promoted from
  // aliases so a forked/captured theme keeps its warm tints instead of
  // reverting to the base bright ones.
  { key: 'green-bg', group: 'semantic', kind: 'color', default: 'rgba(34, 197, 94, 0.08)' },
  { key: 'green-border', group: 'semantic', kind: 'color', default: 'rgba(34, 197, 94, 0.25)' },
  { key: 'yellow-bg', group: 'semantic', kind: 'color', default: 'rgba(245, 158, 11, 0.08)' },
  { key: 'yellow-border', group: 'semantic', kind: 'color', default: 'rgba(245, 158, 11, 0.25)' },
  { key: 'red-bg', group: 'semantic', kind: 'color', default: 'rgba(239, 68, 68, 0.08)' },
  { key: 'red-border', group: 'semantic', kind: 'color', default: 'rgba(239, 68, 68, 0.25)' },
  { key: 'purple-bg', group: 'semantic', kind: 'color', default: 'rgba(139, 92, 246, 0.08)' },
  { key: 'purple-border', group: 'semantic', kind: 'color', default: 'rgba(139, 92, 246, 0.25)' },
  { key: 'teal-bg', group: 'semantic', kind: 'color', default: 'rgba(20, 184, 166, 0.08)' },
  { key: 'teal-border', group: 'semantic', kind: 'color', default: 'rgba(20, 184, 166, 0.25)' },
  { key: 'pink-bg', group: 'semantic', kind: 'color', default: 'rgba(236, 72, 153, 0.08)' },
  { key: 'pink-border', group: 'semantic', kind: 'color', default: 'rgba(236, 72, 153, 0.25)' },
  // Rank/medal colors (contests) — literal, theme-overridable.
  { key: 'gold', group: 'semantic', kind: 'color', default: '#fbbf24' },
  { key: 'silver', group: 'semantic', kind: 'color', default: '#94a3b8' },
  { key: 'bronze', group: 'semantic', kind: 'color', default: '#a0724a' },

  // Code (rich code block + syntax highlight)
  { key: 'code-bg', group: 'code', kind: 'color', default: '#0d1117' },
  { key: 'code-text', group: 'code', kind: 'color', default: '#e6edf3' },
  { key: 'code-header-bg', group: 'code', kind: 'color', default: '#161b22' },
  { key: 'code-border', group: 'code', kind: 'color', default: '#30363d' },
  { key: 'code-muted', group: 'code', kind: 'color', default: '#8b949e' },

  // Typography — font families
  { key: 'font-sans', group: 'typography', kind: 'font-family', default: 'system-ui, -apple-system, sans-serif' },
  { key: 'font-mono', group: 'typography', kind: 'font-family', default: "'JetBrains Mono', ui-monospace, monospace" },
  { key: 'font-heading', group: 'typography', kind: 'font-family', default: 'var(--font-sans)' },
  { key: 'font-body', group: 'typography', kind: 'font-family', default: 'var(--font-sans)' },
  { key: 'font-display', group: 'typography', kind: 'font-family', default: 'var(--font-sans)' },

  // Typography — sizes
  { key: 'text-xs', group: 'typography', kind: 'length', default: '0.75rem' },
  { key: 'text-sm', group: 'typography', kind: 'length', default: '0.875rem' },
  { key: 'text-base', group: 'typography', kind: 'length', default: '1rem' },
  { key: 'text-md', group: 'typography', kind: 'length', default: '1.125rem' },
  { key: 'text-lg', group: 'typography', kind: 'length', default: '1.25rem' },
  { key: 'text-xl', group: 'typography', kind: 'length', default: '1.375rem' },
  { key: 'text-2xl', group: 'typography', kind: 'length', default: '1.75rem' },
  { key: 'text-3xl', group: 'typography', kind: 'length', default: '2.25rem' },
  { key: 'text-4xl', group: 'typography', kind: 'length', default: '3rem' },
  { key: 'text-5xl', group: 'typography', kind: 'length', default: '3.75rem' },
  { key: 'text-6xl', group: 'typography', kind: 'length', default: '4.5rem' },
  { key: 'text-label', group: 'typography', kind: 'length', default: '0.6875rem' },

  // Typography — weights & rhythm
  { key: 'font-weight-normal', group: 'typography', kind: 'font-weight', default: '400' },
  { key: 'font-weight-medium', group: 'typography', kind: 'font-weight', default: '500' },
  { key: 'font-weight-semibold', group: 'typography', kind: 'font-weight', default: '600' },
  { key: 'font-weight-bold', group: 'typography', kind: 'font-weight', default: '700' },
  { key: 'leading-tight', group: 'typography', kind: 'number', default: '1.2' },
  { key: 'leading-snug', group: 'typography', kind: 'number', default: '1.4' },
  { key: 'leading-normal', group: 'typography', kind: 'number', default: '1.7' },
  { key: 'leading-relaxed', group: 'typography', kind: 'number', default: '1.9' },
  { key: 'tracking-tight', group: 'typography', kind: 'length', default: '-0.02em' },
  { key: 'tracking-normal', group: 'typography', kind: 'length', default: '0' },
  { key: 'tracking-wide', group: 'typography', kind: 'length', default: '0.04em' },
  { key: 'tracking-wider', group: 'typography', kind: 'length', default: '0.08em' },
  { key: 'tracking-widest', group: 'typography', kind: 'length', default: '0.12em' },

  // Spacing (4px base)
  { key: 'space-1', group: 'spacing', kind: 'length', default: '0.25rem' },
  { key: 'space-2', group: 'spacing', kind: 'length', default: '0.5rem' },
  { key: 'space-3', group: 'spacing', kind: 'length', default: '0.75rem' },
  { key: 'space-4', group: 'spacing', kind: 'length', default: '1rem' },
  { key: 'space-5', group: 'spacing', kind: 'length', default: '1.25rem' },
  { key: 'space-6', group: 'spacing', kind: 'length', default: '1.5rem' },
  { key: 'space-8', group: 'spacing', kind: 'length', default: '2rem' },
  { key: 'space-10', group: 'spacing', kind: 'length', default: '2.5rem' },
  { key: 'space-12', group: 'spacing', kind: 'length', default: '3rem' },
  { key: 'space-16', group: 'spacing', kind: 'length', default: '4rem' },
  { key: 'space-20', group: 'spacing', kind: 'length', default: '5rem' },
  { key: 'space-24', group: 'spacing', kind: 'length', default: '6rem' },

  // Shape
  { key: 'radius', group: 'shape', kind: 'length', default: '0px', description: 'Universal border-radius — leave at 0 for sharp corners' },
  { key: 'radius-sm', group: 'shape', kind: 'length', default: '2px' },
  { key: 'radius-md', group: 'shape', kind: 'length', default: '0' },
  { key: 'radius-lg', group: 'shape', kind: 'length', default: '0' },
  { key: 'radius-xl', group: 'shape', kind: 'length', default: '0' },
  { key: 'radius-2xl', group: 'shape', kind: 'length', default: '0' },
  { key: 'radius-full', group: 'shape', kind: 'length', default: '50%', description: 'Used on avatars only' },
  { key: 'border-width-thin', group: 'shape', kind: 'length', default: '1px' },
  { key: 'border-width-default', group: 'shape', kind: 'length', default: '2px' },
  { key: 'border-width-thick', group: 'shape', kind: 'length', default: '3px' },

  // Shadows (offset, no blur)
  { key: 'focus-ring', group: 'shadow', kind: 'shadow', default: 'var(--shadow-accent)', description: 'Focus-visible ring/glow' },
  { key: 'shadow-sm', group: 'shadow', kind: 'shadow', default: '2px 2px 0 var(--border)' },
  { key: 'shadow-md', group: 'shadow', kind: 'shadow', default: '4px 4px 0 var(--border)' },
  { key: 'shadow-lg', group: 'shadow', kind: 'shadow', default: '6px 6px 0 var(--border)' },
  { key: 'shadow-xl', group: 'shadow', kind: 'shadow', default: '8px 8px 0 var(--border)' },
  { key: 'shadow-accent', group: 'shadow', kind: 'shadow', default: '4px 4px 0 var(--accent)' },
  // Component surface shadow (buttons/cards). Built-in themes leave it at the
  // offset-block default (they override --shadow-* but NOT these), so their look
  // is unchanged; Theme Studio emits these from the recipe's shadowStyle so a
  // custom theme's buttons/cards reflect its archetype (neumorphic relief, etc.).
  { key: 'shadow-block', group: 'shadow', kind: 'shadow', default: '4px 4px 0 var(--border)', description: 'Resting shadow for buttons/cards' },
  { key: 'shadow-block-sm', group: 'shadow', kind: 'shadow', default: '2px 2px 0 var(--border)', description: 'Pressed/hover shadow for buttons/cards' },

  // Treatments — surface effects. Defaults are TRUE no-ops (`none`, never
  // `blur(0)`: any non-none backdrop-filter creates a stacking context and
  // becomes the containing block for fixed descendants), so built-in themes
  // and existing custom themes render byte-identical unless a theme opts in.
  { key: 'surface-backdrop', group: 'treatment', kind: 'string', default: 'none', description: 'backdrop-filter for cards/panels, e.g. blur(12px) saturate(1.35) for glass' },
  { key: 'bg-image', group: 'treatment', kind: 'string', default: 'none', description: 'Page background gradient (CSS gradients only; url() is rejected on save)' },

  // Motion
  { key: 'transition-fast', group: 'motion', kind: 'transition', default: '0.1s ease' },
  { key: 'transition-default', group: 'motion', kind: 'transition', default: '0.15s ease' },
  { key: 'transition-slow', group: 'motion', kind: 'transition', default: '0.3s ease' },

  // Layout
  { key: 'nav-height', group: 'layout', kind: 'length', default: '3rem' },
  { key: 'subnav-height', group: 'layout', kind: 'length', default: '2.75rem' },
  { key: 'sidebar-width', group: 'layout', kind: 'length', default: '12.5rem' },
  { key: 'sidebar-width-collapsed', group: 'layout', kind: 'length', default: '3.5rem', description: 'Admin sidebar width when collapsed to icons' },
  { key: 'content-max-width', group: 'layout', kind: 'length', default: '60rem' },
  { key: 'content-wide-max-width', group: 'layout', kind: 'length', default: '75rem' },
  { key: 'cpub-card-min', group: 'layout', kind: 'length', default: '260px', description: 'Content-card grid min column width' },
  { key: 'cpub-card-gap', group: 'layout', kind: 'length', default: '20px', description: 'Content-card grid gutter' },

  // Site chrome — top bar, nav links, footer. These existed in base.css (the
  // deveco shape-customization family) but were not registered, so custom
  // themes could not touch them. Defaults are copied VERBATIM from base.css;
  // registering them is a zero-render-change addition.
  { key: 'cpub-topbar-height', group: 'chrome', kind: 'length', default: '48px', description: 'Top bar height (must match the content top offset)' },
  { key: 'cpub-topbar-bg', group: 'chrome', kind: 'color', default: 'var(--surface)', description: 'Top bar background (rgba for glass)' },
  { key: 'cpub-topbar-border', group: 'chrome', kind: 'string', default: 'var(--border-width-default) solid var(--border)', description: 'Top bar bottom border (full shorthand)' },
  { key: 'cpub-topbar-radius', group: 'chrome', kind: 'length', default: '0', description: 'Top bar corner radius (rounded bottom bar)' },
  { key: 'cpub-topbar-shadow', group: 'chrome', kind: 'shadow', default: 'none', description: 'Top bar drop shadow' },
  { key: 'cpub-topbar-position', group: 'chrome', kind: 'string', default: 'fixed', description: 'fixed or sticky; sticky reserves its own space, so also set cpub-content-top-offset to 0' },
  { key: 'cpub-topbar-padding-x', group: 'chrome', kind: 'length', default: '20px', description: 'Top bar horizontal padding' },
  { key: 'cpub-topbar-blur', group: 'chrome', kind: 'string', default: 'none', description: 'Top bar backdrop-filter, e.g. blur(8px)' },
  { key: 'cpub-content-top-offset', group: 'chrome', kind: 'string', default: 'var(--cpub-topbar-height, 48px)', description: 'Space reserved for the fixed bar; 0 when the bar is sticky' },
  { key: 'cpub-nav-link-size', group: 'chrome', kind: 'length', default: '12px', description: 'Nav link font size' },
  { key: 'cpub-nav-link-weight', group: 'chrome', kind: 'font-weight', default: '400', description: 'Nav link font weight' },
  { key: 'cpub-nav-link-padding', group: 'chrome', kind: 'string', default: '5px 12px', description: 'Nav link padding (vertical horizontal)' },
  { key: 'cpub-nav-link-radius', group: 'chrome', kind: 'length', default: 'var(--radius)', description: 'Nav link corner radius (pill links)' },
  { key: 'cpub-nav-link-color', group: 'chrome', kind: 'color', default: 'var(--text-dim)', description: 'Nav link color' },
  { key: 'cpub-nav-link-active-color', group: 'chrome', kind: 'color', default: 'var(--text)', description: 'Active nav link color' },
  { key: 'cpub-nav-link-active-bg', group: 'chrome', kind: 'color', default: 'var(--surface2)', description: 'Active nav link background' },
  { key: 'cpub-nav-link-active-weight', group: 'chrome', kind: 'font-weight', default: '400', description: 'Active nav link font weight' },
  { key: 'cpub-nav-link-active-border', group: 'chrome', kind: 'color', default: 'var(--border)', description: 'Active nav link border color' },
  { key: 'cpub-footer-bg', group: 'chrome', kind: 'color', default: 'var(--surface)', description: 'Footer background' },
  { key: 'cpub-footer-text', group: 'chrome', kind: 'color', default: 'var(--text-dim)', description: 'Footer body/link text' },
  { key: 'cpub-footer-muted', group: 'chrome', kind: 'color', default: 'var(--text-faint)', description: 'Footer column titles / bottom bar' },
  { key: 'cpub-footer-border', group: 'chrome', kind: 'color', default: 'var(--border)', description: 'Footer top border color' },
  { key: 'cpub-footer-link-hover', group: 'chrome', kind: 'color', default: 'var(--text)', description: 'Footer link hover color' },
  { key: 'cpub-footer-heading', group: 'chrome', kind: 'color', default: 'var(--text)', description: 'Footer brand/logo text color' },

  // Z-index
  { key: 'z-dropdown', group: 'z-index', kind: 'number', default: '100' },
  { key: 'z-sticky', group: 'z-index', kind: 'number', default: '200' },
  { key: 'z-fixed', group: 'z-index', kind: 'number', default: '500' },
  { key: 'z-modal-backdrop', group: 'z-index', kind: 'number', default: '900' },
  { key: 'z-modal', group: 'z-index', kind: 'number', default: '1000' },
  { key: 'z-toast', group: 'z-index', kind: 'number', default: '1050' },
  { key: 'z-tooltip', group: 'z-index', kind: 'number', default: '1100' },
];

// ---- Backward-compat aliases ------------------------------------------

/**
 * Tokens that exist in `theme/base.css` for legacy reasons but aren't
 * surfaced in the editor UI. `validateTokenOverrides` still accepts them
 * so existing saved overrides keep working.
 */
export const ALIAS_TOKEN_NAMES: readonly string[] = [
  // Surface aliases (var()-based, self-heal). The literal overlays/scrim are
  // now canonical in TOKEN_SPECS.
  'color-surface', 'color-surface-alt', 'color-surface-raised',
  'color-surface-hover', 'color-bg-subtle',
  // Text aliases
  'color-text', 'color-text-secondary', 'color-text-muted',
  // Border aliases
  'color-border', 'color-border-strong', 'color-border-focus',
  // Accent aliases (var()-based — self-heal from the canonical accent/derived
  // tokens, so they need no capture). The literal accent tints
  // (accent-bg-strong/heavy/solid, accent-focus-ring, color-accent-hover) are
  // now canonical in TOKEN_SPECS so fork/capture pick them up.
  'color-primary', 'color-accent',
  'color-accent-bg', 'color-accent-border',
  // Semantic aliases (var()-based, self-heal). The literal *-bg / *-border
  // tints are now canonical in TOKEN_SPECS.
  'color-success', 'color-warning', 'color-error', 'color-info',
  'color-success-bg', 'color-warning-bg', 'color-error-bg', 'color-info-bg',
  // Code highlight extras
  'code-green', 'hljs-comment', 'hljs-keyword', 'hljs-literal',
  'hljs-string', 'hljs-deletion', 'hljs-meta', 'hljs-name', 'hljs-variable',
  // Misc
  // (color-link / color-link-hover are canonical in TOKEN_SPECS, not aliases)
  'radius-none',
];

/** Flat list of canonical token names — TOKEN_SPECS keys plus the alias set. */
export const TOKEN_NAMES: string[] = [...TOKEN_SPECS.map((t) => t.key), ...ALIAS_TOKEN_NAMES];

const TOKEN_SET = new Set(TOKEN_NAMES);

// ---- Editor metadata --------------------------------------------------

/** Display labels for token groups, used in the editor UI. */
export const TOKEN_GROUP_LABELS: Record<TokenGroup, { label: string; icon: string; description: string }> = {
  surfaces: { label: 'Surfaces', icon: 'fa-layer-group', description: 'Page, card, and panel backgrounds' },
  text: { label: 'Text', icon: 'fa-font', description: 'Body, secondary, and inverse text colors' },
  borders: { label: 'Borders', icon: 'fa-border-style', description: 'Strong and soft border colors' },
  accent: { label: 'Accent', icon: 'fa-paint-roller', description: 'Primary brand accent + link colors' },
  semantic: { label: 'Semantic', icon: 'fa-circle-info', description: 'Success / warning / error / info colors' },
  code: { label: 'Code', icon: 'fa-code', description: 'Code block + syntax highlight colors' },
  typography: { label: 'Typography', icon: 'fa-text-height', description: 'Fonts, sizes, weights, line-heights' },
  spacing: { label: 'Spacing', icon: 'fa-ruler-combined', description: 'Margin and padding scale' },
  shape: { label: 'Shape', icon: 'fa-shapes', description: 'Border radius + border widths' },
  shadow: { label: 'Shadows', icon: 'fa-clone', description: 'Offset shadow scale' },
  treatment: { label: 'Treatments', icon: 'fa-droplet', description: 'Glass backdrop + page background gradient' },
  motion: { label: 'Motion', icon: 'fa-wand-magic-sparkles', description: 'Transition durations + easings' },
  layout: { label: 'Layout', icon: 'fa-table-cells-large', description: 'Nav height, sidebar width, card grid, max widths' },
  chrome: { label: 'Site chrome', icon: 'fa-window-maximize', description: 'Top bar, nav links, and footer shape + colors' },
  'z-index': { label: 'Z-Index', icon: 'fa-layer-group', description: 'Stacking-context scale' },
};

export const TOKEN_GROUP_ORDER: TokenGroup[] = [
  'surfaces', 'text', 'borders', 'accent', 'semantic', 'code',
  'typography', 'spacing', 'shape', 'shadow', 'treatment', 'motion',
  'layout', 'chrome', 'z-index',
];

// ---- Helpers ----------------------------------------------------------

/** Get a token spec by key (for editor input selection). */
export function getTokenSpec(key: string): TokenSpec | undefined {
  return TOKEN_SPECS.find((s) => s.key === key);
}

/** Group all known tokens by category for editor rendering. */
export function tokensByGroup(): Record<TokenGroup, TokenSpec[]> {
  const out = {} as Record<TokenGroup, TokenSpec[]>;
  for (const group of TOKEN_GROUP_ORDER) out[group] = [];
  for (const spec of TOKEN_SPECS) out[spec.group].push(spec);
  return out;
}

/** Partition a token-name list into `valid` (canonical or alias) and `invalid`. */
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
