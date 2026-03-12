# Research: Svelte 5 Component Libraries

## Date: 2026-03-09

## Question

How do modern Svelte 5 component libraries (Melt UI, Bits UI, Skeleton) build and distribute headless components? What tooling and patterns should @commonpub/ui adopt?

## Findings

### Build Tooling: `svelte-package`

All major Svelte component libraries use `@sveltejs/package` (the `svelte-package` CLI) for compilation:

- **What it does**: Processes `src/lib/` (or configured source dir), compiles `.svelte` files, generates `.d.ts` type declarations, copies non-Svelte files (`.ts`, `.css`) to output directory
- **Output**: Compiled `.svelte` components + TypeScript declarations. Consumers compile with their own Svelte version.
- **Key config**: `svelte.config.js` with `vitePreprocess` for TypeScript support in `<script lang="ts">`
- **Package exports**: Use `"svelte"` condition in `exports` map for Svelte-aware bundlers

### Headless Patterns

Two main approaches in the ecosystem:

**1. Action-based (Melt UI pattern)**

- Export builder functions that return Svelte actions + state
- Consumer applies actions to their own HTML elements
- Maximum flexibility, minimum opinion
- More verbose for consumers

```typescript
const { trigger, content, open } = createPopover();
// Consumer: <button use:trigger>...</button>
```

**2. Component-based (Bits UI / Skeleton pattern)**

- Export `.svelte` components with slots/snippets
- Components handle ARIA, keyboard, focus management internally
- Accept `class` prop for external styling
- Less flexible but faster to use

```svelte
<Popover.Root>
  <Popover.Trigger class="my-trigger">Click me</Popover.Trigger>
  <Popover.Content class="my-content">...</Popover.Content>
</Popover.Root>
```

### Decision for @commonpub/ui

**Component-based approach** (Bits UI style) because:

- Aligns with Standing Rule #12 (accessibility-first) — ARIA baked into components
- `class` prop convention matches Standing Rule #3 (var(--\*) styling)
- Simpler consumer API for Phase 4 reference app
- Svelte 5 snippets replace slots cleanly

### Svelte 5 Runes in Components

- Use `$props()` for component props (replaces `export let`)
- Use `$state()` for internal reactive state
- Use `$derived()` for computed values
- Use `$effect()` for side effects (sparingly)
- Use `{@render children()}` for slot content (Svelte 5 snippets)

### Testing

- `@testing-library/svelte` v5 supports Svelte 5 runes
- `@sveltejs/vite-plugin-svelte` required in vitest config for `.svelte` file processing
- `jsdom` environment for DOM testing
- `vitest-axe` wraps axe-core for accessibility assertions

## Sources

- @sveltejs/package documentation
- Bits UI source (GitHub)
- Melt UI source (GitHub)
- Svelte 5 runes RFC and documentation
