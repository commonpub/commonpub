# ADR-011: Svelte Component Library Build System

## Status

Accepted

## Context

@commonpub/ui needs a build system that compiles Svelte 5 components with TypeScript for distribution as a package within the monorepo. The current `tsc` build step cannot process `.svelte` files.

## Decision

Use `svelte-package` from `@sveltejs/package` as the build tool for @commonpub/ui.

- **Build**: `svelte-package` replaces `tsc`. Processes `.svelte` files, generates `.d.ts` declarations, copies `.ts` and `.css` files to output.
- **Typecheck**: `svelte-check` replaces `tsc --noEmit`. Understands `.svelte` file types and runes syntax.
- **Config**: `svelte.config.js` with `vitePreprocess` for `<script lang="ts">` support.
- **Testing**: `@sveltejs/vite-plugin-svelte` in vitest config enables `.svelte` imports in tests.
- **Output**: Compiled components in `dist/`. Consumers compile with their own Svelte version (peer dependency).

### Package Exports

```json
{
  "svelte": "./dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "import": "./dist/index.js"
    },
    "./theme/*.css": "./theme/*.css"
  }
}
```

## Alternatives Considered

1. **vite library mode** — More complex, designed for final bundles not component libraries. `svelte-package` is purpose-built.
2. **tsc only** — Cannot process `.svelte` files. Would require all components as `.ts` files with render functions, losing Svelte's template syntax.

## Consequences

- @commonpub/ui's `build` and `typecheck` scripts differ from other packages (svelte-package/svelte-check vs tsc)
- `svelte ^5.0.0` is a peer dependency — consumers provide their own Svelte
- Theme CSS files exported directly (no processing needed)
- `.svelte` files in `dist/` are pre-processed but not compiled to JS — consumers' bundlers handle final compilation
