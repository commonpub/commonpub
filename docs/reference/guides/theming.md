# Theming

> Server-resolved theme system with admin-managed families, user light/dark toggle, CSS custom property tokens, and cookie-consented preferences.

**Source**: `packages/ui/theme/`, `layers/base/utils/themeConfig.ts`

---

## Theme Families

Themes are organized into families. The admin picks a family for the instance; users toggle between light and dark mode within that family.

| Family | Light ID | Dark ID | Accent | Display Font | Body Font |
|--------|----------|---------|--------|-------------|-----------|
| **Classic** | `base` | `dark` | Blue `#5b9cf6` | system-ui | system-ui |
| **Agora** | `agora` | `agora-dark` | Green `#3d8b5e` | Fraunces (serif) | Work Sans |
| **Generics** | `generics` | `generics` | Blue `#5b9cf6` | system-ui | system-ui |

Theme CSS files in `packages/ui/theme/`:

- `base.css` — Classic light (tokens on `:root`)
- `dark.css` — Classic dark (`[data-theme="dark"]`)
- `generics.css` — Generics dark (`[data-theme="generics"]`)
- `agora.css` — Agora light (`[data-theme="agora"]`)
- `agora-dark.css` — Agora dark (`[data-theme="agora-dark"]`)
- `components.css`, `prose.css`, `layouts.css`, `forms.css`, `editor-panels.css` — Shared styles

---

## How It Works

### Server-Side Resolution (Zero Flash)

Theme is resolved on the server before HTML is sent. No client-side flash.

```
Request → Server Middleware → Plugin (useHead) → SSR HTML with data-theme
```

1. **Server middleware** (`layers/base/server/middleware/theme.ts`) reads the instance default from DB (cached 60s) and the user's `cpub-color-scheme` cookie
2. **Theme plugin** (`layers/base/plugins/theme.ts`) reads the resolved theme from event context and sets `data-theme` on `<html>` via `useHead`
3. **First paint** has the correct theme — zero flash of unstyled content

### Admin Controls

Admins manage the instance theme at `/admin/theme`:

- **Family selection** — Pick Classic, Agora, or Generics (sets the light variant as default)
- **Token overrides** — Override individual CSS tokens instance-wide (accent color, fonts, spacing, etc.)

Changes are stored in `instanceSettings` and take effect within 60 seconds (cache TTL).

### User Controls

Users toggle light/dark mode at `/settings/appearance`:

- **Light/Dark toggle** — Switches between the family's light and dark variants
- **Cookie consent** — Dark mode preference is only persisted to cookie (`cpub-color-scheme`) after the user accepts functional cookies via the consent banner
- Without consent, the toggle works for the current session but resets on page reload

### Resolution Priority

1. User's `cpub-color-scheme` cookie (light/dark within family)
2. Admin's instance default theme
3. Fallback: `base`

---

## Adding a New Theme

1. Create CSS files in `packages/ui/theme/` using `[data-theme="your-theme"]` selector
2. Register in `packages/ui/src/theme.ts` — add to `BUILT_IN_THEMES` with `family` field
3. Add family mapping in `layers/base/utils/themeConfig.ts` — `THEME_TO_FAMILY`, `FAMILY_VARIANTS`, `IS_DARK`
4. Add theme ID to `VALID_IDS` in `packages/server/src/theme.ts`
5. Add CSS import in `layers/base/nuxt.config.ts`
6. Add preview colors in admin and appearance pages

---

## CSS Token Reference (192 tokens)

All tokens are CSS custom properties prefixed with `--`. Use them as `var(--token-name)`. **Never hardcode colors or fonts** (standing rule #3).

### Surface Colors

| Token | Purpose |
|-------|---------|
| `bg` | Page background |
| `surface` | Card/panel background |
| `surface2` | Secondary surface |
| `surface3` | Tertiary surface |
| `color-surface` | Alias for `surface` |
| `color-surface-alt` | Alias for `surface2` |
| `color-surface-raised` | Cards, modals |
| `color-surface-overlay` | Overlay backdrop |
| `color-surface-hover` | Surface hover state |
| `color-bg-subtle` | Subtle background |

### Text Colors

| Token | Purpose |
|-------|---------|
| `text` | Primary text |
| `text-dim` | Secondary text |
| `text-faint` | Muted/disabled text |
| `color-text` | Alias for `text` |
| `color-text-secondary` | Alias for `text-dim` |
| `color-text-muted` | Alias for `text-faint` |
| `color-text-inverse` | Text on dark backgrounds |

### Accent & Brand Colors

| Token | Purpose |
|-------|---------|
| `accent` | Primary accent color |
| `accent-bg` | Accent background tint |
| `accent-border` | Accent-tinted border |
| `color-primary` / `color-accent` | Aliases for `accent` |
| `color-primary-hover` / `color-accent-hover` | Hover states |
| `color-primary-text` / `color-on-primary` | Text on accent bg |

### Semantic Colors

`green`, `yellow`, `red`, `purple`, `teal`, `pink` — each with `-bg` and `-border` variants. Plus aliases: `color-success`, `color-warning`, `color-error`, `color-info` with `-bg` variants.

### Typography

| Token | Purpose |
|-------|---------|
| `font-sans` | Sans-serif stack |
| `font-mono` | Monospace stack |
| `font-display` | Display/decorative font (Agora: Fraunces) |
| `font-heading` | Heading font family |
| `font-body` | Body font family |
| `text-xs` through `text-6xl` | Font size scale |
| `text-label` | Small monospace UI labels |
| `font-weight-normal/medium/semibold/bold` | Font weights |
| `leading-tight/snug/normal/relaxed` | Line heights |
| `tracking-tight/normal/wide/wider/widest` | Letter spacing |

### Spacing, Shape, Shadows, Layout

| Category | Tokens |
|----------|--------|
| Spacing | `space-1` through `space-24` (4px base) |
| Radius | `radius-none/sm/md/lg/xl/2xl/full` |
| Border width | `border-width-thin/default/thick` |
| Shadows | `shadow-sm/md/lg/xl/accent` (offset, no blur) |
| Transitions | `transition-fast/default/slow` |
| Z-index | `z-dropdown/sticky/fixed/modal-backdrop/modal/toast/tooltip` |
| Layout | `nav-height`, `subnav-height`, `sidebar-width`, `content-max-width`, `content-wide-max-width` |
| Focus | `focus-ring` |

---

## Theme API (`@commonpub/ui`)

### `BUILT_IN_THEMES: ThemeDefinition[]`

Array of all 5 built-in theme definitions.

```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  family: string;  // 'classic' | 'agora' | 'generics'
}
```

### `isValidThemeId(id: string): boolean`

Returns `true` if `id` matches a built-in theme.

### `validateTokenOverrides(overrides): { valid, invalid }`

Validates token override keys against `TOKEN_NAMES` (192 entries).

### `applyThemeToElement(el, themeId, overrides?): void`

Sets `data-theme` attribute and applies inline CSS custom property overrides.

### `getThemeFromElement(el): { themeId, overrides }`

Reads the current theme and any inline overrides from a DOM element.

---

## Cookie Consent

The theme system integrates with cookie consent (`useCookieConsent` composable). The `cpub-color-scheme` cookie is categorized as **functional** — it's only set after the user accepts functional cookies via the consent banner.

Instance operators can register additional cookies in `commonpub.config.ts`:

```typescript
defineCommonPubConfig({
  cookies: [
    { name: '_ga', category: 'analytics', description: 'Google Analytics', duration: '2 years', provider: 'Google' },
  ],
})
```

Built-in cookies (always registered):
- `better-auth.session_token` — essential, 7 days
- `cpub-consent` — essential, 1 year
- `cpub-color-scheme` — functional, 1 year
