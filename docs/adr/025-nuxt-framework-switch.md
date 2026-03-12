# ADR 025: Framework Switch — SvelteKit → Nuxt 3

## Status
Accepted (2026-03-11). Supersedes ADR 001 (SvelteKit).

## Context
The UI layer needed a complete rebuild regardless of framework choice. Evaluation factors:

1. **TipTap integration**: `@tiptap/vue-3` is native Vue; Svelte required custom wrappers
2. **Team experience**: Existing Vue/Nuxt experience from hack-build (Vue 3 + Convex) and deveco-io (Nuxt 3 + Drizzle)
3. **Component ecosystem**: Larger Vue component ecosystem
4. **SSR/SEO**: Nuxt's `useSeoMeta()`, per-route rendering modes, and ISR are superior
5. **Auth**: `@better-auth/nuxt` module provides tighter integration
6. **Same effort**: Starting from scratch in either framework is equivalent work

## Decision
- Switch `@commonpub/ui` from Svelte 5 to Vue 3 SFCs
- Switch `apps/reference` from SvelteKit to Nuxt 3
- All 8 framework-agnostic packages (schema, config, protocol, auth, docs, editor, explainer, learning) remain unchanged
- New `@commonpub/server` package consolidates framework-agnostic business logic

## Framework Coupling Analysis
| Package | Switch Impact |
|---------|--------------|
| schema, config, protocol, docs, editor, explainer, learning, test-utils | Zero — pure TypeScript |
| **ui** | Full rewrite → Vue 3 SFC |
| **auth** | Swap SvelteKit hook → framework-agnostic middleware |
| **apps/reference** | Full rebuild as Nuxt 3 |

## Consequences
- 16 Svelte components deleted, rebuilt as ~21 Vue 3 components
- SvelteKit reference app (~142 .svelte files) deleted, rebuilt as Nuxt 3 app
- Server-side business logic extracted to `@commonpub/server` (framework-agnostic)
- Vue 3 Composition API with `<script setup lang="ts">` — no Options API
- Nuxt conventions: auto-imports, file-based routing, Nitro server routes
