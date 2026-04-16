# Accessibility Audit — CommonPub v1

## Standard

WCAG 2.1 AA (Standing Rule 12)

## Testing Approach

### Unit Tests

- All `@commonpub/ui` components tested with `axe-core` via `expectNoA11yViolations()`
- 116 component tests include keyboard navigation and ARIA attribute assertions

### E2E Tests (`apps/reference/e2e/a11y.spec.ts`)

- Home page — no critical violations (WCAG 2.1 A + AA)
- Auth sign-in page — no critical violations
- Dashboard — no critical violations (feature-flag aware)
- Base theme — color contrast check
- Deepwood theme — color contrast check
- Keyboard accessibility — all interactive elements reachable

### Theme Contrast Verification

Base theme verified against WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text):

| Theme     | Status |
| --------- | ------ |
| base (light/dark) | Pass |

## Component Standards

- All components accept `class` prop for external styling
- All interactive elements are keyboard navigable
- All interactive elements have ARIA labels
- Semantic HTML throughout (nav, main, footer, section, article)
- No CSS-only interactivity — all states programmatically available

## Known Limitations

- `'unsafe-inline'` in CSP for Nuxt hydration scripts
- CodeMirror and TipTap editors rely on their own a11y implementations
- Dynamic content loaded after page render may not be caught by static axe scans

## Tools

- `axe-core` ^4.10.0 — unit test a11y scanning
- `@axe-core/playwright` — E2E a11y scanning
- Manual testing with VoiceOver (macOS) for key flows
