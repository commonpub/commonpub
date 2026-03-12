# Coding Standards

## TypeScript

- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess: true`
- **No `any`**: Use `unknown` and narrow, or define proper types
- **Explicit return types** on all exported functions
- **Prefer `const`** over `let`, never use `var`
- **Use Drizzle query builder** — no raw SQL unless necessary and documented

## Svelte

- **Svelte 5 runes** syntax (`$state`, `$derived`, `$effect`, `$props`)
- **No legacy `$:` reactive syntax**
- **Components accept `class` prop** for external styling
- **Events use callback props**, not custom events

## CSS

- **CSS custom properties only** — `var(--*)` for all colors, fonts, spacing, shadows
- **No hardcoded values** in component styles
- **Token contract** defined in `packages/ui/theme/base.css`
- **BEM-like class naming** for component-scoped styles

## File Naming

| Type               | Convention | Example              |
| ------------------ | ---------- | -------------------- |
| Svelte components  | PascalCase | `ProjectCard.svelte` |
| TypeScript modules | camelCase  | `contentService.ts`  |
| Schema files       | camelCase  | `learningPath.ts`    |
| CSS files          | kebab-case | `base-tokens.css`    |
| Test files         | \*.test.ts | `config.test.ts`     |
| ADRs               | NNN-kebab  | `001-sveltekit.md`   |

## Testing

- **Write tests first** (TDD)
- **One assertion per test** when practical
- **Descriptive test names**: "should reject invalid email format"
- **Use test factories** from `@commonpub/test-utils`
- **Accessibility tests** on all interactive components

## Git

- **Conventional commits**: `type(scope): description`
- **Atomic commits**: one logical change per commit
- **Branch naming**: `feat/description`, `fix/description`, `test/description`
- **Squash merge** to main

## Accessibility

- **WCAG 2.1 AA minimum**
- **Keyboard navigable**: all interactive elements reachable via Tab, operable via Enter/Space
- **ARIA labels** on all interactive elements without visible text
- **Focus indicators** visible and high-contrast
- **Color not sole indicator** — always pair with text/icon
- **Reduced motion** respected via `prefers-reduced-motion`

## Security

- **Never trust client input** — validate at API boundary with Zod
- **Parameterized queries** only (Drizzle handles this)
- **CSP headers** configured in SvelteKit hooks
- **Rate limiting** on auth and API endpoints
- **No secrets in code** — environment variables only
