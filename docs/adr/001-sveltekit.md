# ADR-001: SvelteKit as Application Framework

## Status

Superseded by [ADR 025](025-nuxt-framework-switch.md) (2026-03-11)

## Context

We need a full-stack web framework for building the CommonPub reference application and future instances. Options considered: Next.js, Nuxt 3, SvelteKit, Remix.

Previous implementations used Vue 3 (hack-build) and Nuxt 3 (deveco-io). Both taught us valuable lessons but neither codebase is being carried forward.

## Decision

Use SvelteKit with adapter-node for applications and adapter-static for the commonpub.com marketing site.

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
- Need to build headless UI components (opportunity for @commonpub/ui)
- Fedify has official @fedify/sveltekit adapter
