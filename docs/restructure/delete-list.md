# Files to Delete (Phase 2)

## Entire Directories
| Path | Reason |
|------|--------|
| `apps/landing/` | Rebuild later when product is ready |
| `apps/reference/` | Full SvelteKit app, rebuild as Nuxt 3 |
| `tools/create-commonpub/target/` | Rust build artifacts |

## Individual Files (after extracting patterns)
| Path | Reason |
|------|--------|
| `packages/ui/src/components/*.svelte` | Rebuild as Vue 3 SFC |
| `packages/ui/src/test-setup.ts` | Svelte test infrastructure |
| `packages/ui/src/test-helpers.ts` | Svelte test infrastructure |
| `packages/ui/svelte.config.js` | No longer needed |
| `docs/mockups/cpub-*.html` | Wrong name, outdated |

## Dependencies to Remove
- `svelte`, `@sveltejs/kit`, `@sveltejs/adapter-node`, `@sveltejs/adapter-static`
- `@sveltejs/vite-plugin-svelte`, `svelte-check`, `svelte-preprocess`
- `@testing-library/svelte`
- `prettier-plugin-svelte` (root)

## Theme CSS to Remove (Phase 4)
| Path | Reason |
|------|--------|
| `packages/ui/theme/hackbuild.css` | Old theme, replaced by new token system |
| `packages/ui/theme/deepwood.css` | Old theme |
| `packages/ui/theme/deveco.css` | Old theme |
