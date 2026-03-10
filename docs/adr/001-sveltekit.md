# ADR-001: SvelteKit as Application Framework

## Status
Accepted

## Context
We need a full-stack web framework for building the Snaplify reference application and future instances. Options considered: Next.js, Nuxt 3, SvelteKit, Remix.

Previous implementations used Vue 3 (hack-build) and Nuxt 3 (deveco-io). Both taught us valuable lessons but neither codebase is being carried forward.

## Decision
Use SvelteKit with adapter-node for applications and adapter-static for the snaplify.com marketing site.

## Rationale
- Svelte 5 runes provide excellent reactivity with minimal boilerplate
- SvelteKit's file-based routing and server functions align with our needs
- adapter-node provides flexible self-hosted deployment
- Smaller bundle sizes compared to React/Vue equivalents
- Growing ecosystem with good TypeScript support
- Clean separation between server and client code

## Consequences
- Team must learn Svelte 5 runes syntax
- Fewer pre-built component libraries compared to React ecosystem
- Need to build headless UI components (opportunity for @snaplify/ui)
- Fedify has official @fedify/sveltekit adapter
