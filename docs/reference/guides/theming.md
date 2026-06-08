# Theming

> Server-resolved theme system with admin-managed families, user light/dark toggle, CSS custom property tokens, and cookie-consented preferences.
>
> **Looking for the admin theme editor?** That's a separate document — see [`theme-editor.md`](theme-editor.md) for custom themes, code-registered themes from `commonpub.config.ts`, the preview scene system, and import/export.

**Source**: `packages/ui/theme/`, `layers/base/utils/themeConfig.ts`

---

## Theme Families

Themes are organized into families. The admin picks a family for the instance; users toggle between light and dark mode within that family.

| Family | Light ID | Dark ID | Accent | Display Font | Body Font |
|--------|----------|---------|--------|-------------|-----------|
| **Stoa** (default) | `stoa` | `stoa-dark` | Moss `#3c8262` | Fraunces (serif; Newsreader for prose) | Work Sans |
| **Classic** | `base` | `dark` | Blue `#5b9cf6` | system-ui | system-ui |
| **Agora** | `agora` | `agora-dark` | Green `#3d8b5e` | Fraunces (serif) | Work Sans |
| **Generics** | `generics` | `generics` | Blue `#5b9cf6` | system-ui | system-ui |

Theme CSS files in `packages/ui/theme/`:

- `base.css` — Classic light (tokens on `:root`)
- `dark.css` — Classic dark (`[data-theme="dark"]`)
- `generics.css` — Generics dark (`[data-theme="generics"]`)
- `agora.css` — Agora light (`[data-theme="agora"]`)
- `agora-dark.css` — Agora dark (`[data-theme="agora-dark"]`)
- `stoa.css` — Stoa light, the default (`[data-theme="stoa"]`)
- `stoa-dark.css` — Stoa dark (`[data-theme="stoa-dark"]`)
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

Array of all 7 built-in theme definitions.

```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  family: string;  // 'classic' | 'agora' | 'generics' | 'stoa'
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

---

## Custom Theme Overrides — Class-Naming Gotchas

Operators sometimes write a global stylesheet that re-skins layer
components (heatsync's `theme/heatsync-ui.css` is the canonical
example). Before adding `!important` overrides to layer classes,
verify the class is unique to the layout you intend to target —
**layer classes named `cpub-*-grid`, `cpub-prose`, `cpub-sidebar`,
etc. are not always view-exclusive**, and a "homepage-only" override
of a name shared by another view will silently break that view at
desktop widths.

### View-identity classes (safe to target)

These classes are **scoped to exactly one component** and are safe
override targets for a per-view re-skin:

| Class | Used by | Purpose |
|---|---|---|
| `cpub-content-grid` | `pages/index.vue`, `components/homepage/ContentGridSection.vue` | **Homepage feed/card grid only.** |
| `cpub-project-grid` | `components/views/ProjectView.vue` | Project page's TOC \| content \| sidebar grid. Modifier classes `cpub-has-toc` and `cpub-has-sidebar` toggle 4 grid layouts. |
| `cpub-prose` | `views/ArticleView.vue`, `views/ProjectView.vue`, others | **NOT view-exclusive** — generic body-prose styling. Override only via scoped parent selector. |
| `cpub-listing-grid` | `pages/blog.vue`, `pages/projects/index.vue`, etc. | Listing-page card grid. |

### The footgun: shared "generic" classes

`cpub-content-grid` was historically used by BOTH the homepage's
`ContentGridSection` and the project view (before session 150 / layer
0.21.17 renamed the project use to `cpub-project-grid`). An operator
who wrote:

```css
/* Intended for the homepage card grid only */
.cpub-content-grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
}
```

…silently broke the project view's TOC|content|sidebar layout —
the `!important` won over Vue's scoped `[data-v-XXX]` selector, and
the 3 grid children became auto-filled 280px columns, leaving the
body squished and the right side empty. (See session 150 + 0.21.17.)

### Recommended override patterns

**Prefer the view-identity class.** If you only want to re-skin the
homepage card grid, target `.cpub-content-grid`. If you want to
re-skin the project layout, target `.cpub-project-grid`. Operators
do not need to use `!important` if the override matches the layer's
specificity (0,2,0) — `.cpub-project-grid.cpub-has-toc` is enough.

**For generic classes (`cpub-prose`, `cpub-sidebar`, etc.), scope by
parent.** Target a specific page-body element or use a route-class
hook:

```css
/* Re-skin prose ONLY on /blog/* pages, not project/explainer/docs */
:where(.cpub-blog-page) .cpub-prose { ... }
```

**Use `!important` sparingly.** Vue scoped styles (the layer's
default) compile to `[data-v-XXX]` selectors (specificity 0,2,0).
A plain operator selector at 0,1,0 will lose; bumping to 0,2,0
(e.g. `.cpub-project-grid.cpub-has-toc`) is enough. Reach for
`!important` only when the layer's selector chain is genuinely
unbeatable.

**Before publishing a theme override, grep the layer source for
the class name** to confirm it's used by exactly the view(s) you
intend to target:

```bash
grep -rn 'cpub-content-grid' layers/base/ --include='*.vue'
```

If more than one component appears, either rename one of them in
the layer (preferred — closes the footgun for all operators) or use
a scoped parent selector in your theme.

### Most-shared "looks generic" classes (as of layer 0.21.17)

These classes appear in many components. A global `!important`
override hits all of them — generally fine when the override is
purely cosmetic and the harmonization is desired (heatsync's
button-press effect is a good example), but a structural override
(grid/layout/sizing) will likely break some view it wasn't intended
for. Cross-check before overriding any of these:

| Class | Used by N components | Typical content |
|---|---|---|
| `cpub-sidebar` | 12 | right-column asides on hubs/learn/videos/profile/search/explainer/project |
| `cpub-prose` | 8 | article/blog/project body prose, lesson body, docs body, hub-post body |
| `cpub-sb-card` | 8 | sidebar cards (stats, hubs, contests, BOM, hub-card) |
| `cpub-tab` / `cpub-tabs-inner` | 4–6 | tab strips on homepage feed, hub layout, project, user profile, notifications |
| `cpub-sb-title` | 5 | sidebar card title labels |
| `cpub-engagement-row` / `cpub-engage-btn` | 2–3 | like/bookmark/share rows on article + project |
| `cpub-cover-photo` | 2 | hero cover image on article + project |
| `cpub-btn` / `cpub-btn-primary` | many | generic button skin |

**Heatsync's session-150 override touched 5 ProjectView classes
unintentionally** (`cpub-content-grid` was the actual bug; the
other 4 — `cpub-btn`, `cpub-tab`, `cpub-tabs-inner`, `cpub-sb-card`
— were cosmetic harmonizations that worked as intended even though
they were authored as "homepage-only" rules). The lesson: **if the
override is purely cosmetic and you'd accept the change across all
views, a global rule is fine**; **if the override is structural or
intended to shape only one view's layout, target the view-identity
class** (`cpub-content-grid` for homepage, `cpub-project-grid` for
project, `cpub-article-wrap` for article, `cpub-listing-grid` for
listings).
