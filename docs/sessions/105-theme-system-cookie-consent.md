# Session 105 — Theme System, Agora Theme, Cookie Consent

**Date**: 2026-04-04

## What Was Done

### Agora Theme (from design-system-v2)

Converted the design-system-v2 "Agora" mockups into proper theme CSS files:

- `packages/ui/theme/agora.css` — Warm parchment backgrounds (#f7f4ed), green accent (#3d8b5e), Fraunces serif display font, Work Sans body
- `packages/ui/theme/agora-dark.css` — Grove-tinted dark (#0d1a12) with brighter green accent (#4aa06e)

### Server-Side Theme Resolution

Replaced client-side localStorage theme switching with server-resolved SSR:

- **Server middleware** resolves theme on every page request (cached 60s)
- **Nuxt plugin** sets `data-theme` on `<html>` via `useHead` during SSR — zero FOUC
- **Admin picks instance theme family** (Classic, Agora, Generics) at `/admin/theme`
- **Users only toggle light/dark** within the family at `/settings/appearance`
- Dark mode preference stored in `cpub-color-scheme` cookie (guarded by consent)
- Middleware skips API routes for performance

### Cookie Consent System

GDPR-compliant, config-driven cookie consent:

- `CookieDefinition` type added to `@commonpub/config`
- `useCookieConsent` composable — manages consent state, built-in cookie registry, extensible
- `CookieConsent.vue` banner — "Essential only" / "Accept all", slide-up animation
- `/cookies` page — Full cookie policy with categorized tables and consent controls
- Instance operators add custom cookies via `commonpub.config.ts` `cookies` field
- Privacy page updated to reference new cookie policy

### Admin Theme UI

- `/admin/theme` page with family selector (shows light+dark previews side-by-side)
- Token override editor for instance-level CSS customization
- "Theme" link added to admin sidebar

### Legacy Cleanup

- Removed all deepwood/hackbuild/deveco references from code (6 files)
- Updated CLI scaffolder theme choices
- Updated explainer export templates with current theme palettes

### Bug Fixes

- **Settings API Map spread** — `getInstanceSettings()` returns a Map but was spread as object (silently dropped DB values). Fixed with explicit Map→object conversion.
- **generics.css never imported** — Theme existed in BUILT_IN_THEMES but CSS was never loaded in nuxt.config. Added import.

### Architecture

- Shared theme config at `layers/base/utils/themeConfig.ts` (THEME_TO_FAMILY, FAMILY_VARIANTS, IS_DARK)
- `ThemeDefinition` type now has `family` field for grouping light/dark variants
- `font-display` added to TOKEN_NAMES (192 total tokens)
- Google Fonts (Fraunces, Work Sans) loaded via CDN link in nuxt head

## Decisions Made

1. **Admin sets family, user toggles mode** — Simplest model. No per-user theme cookie needed.
2. **Server-side resolution** — Theme resolved in middleware, not client-side. Eliminates FOUC.
3. **Cookie consent required for functional cookies** — `cpub-color-scheme` only persisted after consent. Without consent, dark mode toggle works in-session but doesn't persist.
4. **60-second cache TTL** — Balance between responsiveness to admin changes and DB load.
5. **Middleware skips /api routes** — Theme only needed for SSR page renders.

## Open Questions

- Should we lazy-load Google Fonts only when Agora theme is active? (Currently loaded for all themes)
- Should the cookie consent banner be behind a feature flag for instances that only use essential cookies?
- Should we add `prefers-color-scheme` media query as a third option for auto dark mode?

## Next Steps

- Consider adding more theme families (potential community contributions)
- Dynamic font loading to avoid loading Fraunces/Work Sans when Classic is active
- `prefers-color-scheme` auto-detection for users who haven't set a preference
