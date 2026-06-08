# ADR-004: Fedify for ActivityPub Federation

## Status

**Superseded.** This decision was reversed during implementation: CommonPub federation is a
**hand-rolled, pure-TypeScript** ActivityPub implementation in `@commonpub/protocol` with **zero
Fedify dependency** (HTTP Signatures via `jose`, no `@fedify/*` packages, no external AP queue —
delivery is the pure-TS `federation-delivery` polling worker). The SvelteKit assumption here was
also superseded by the move to Nuxt (ADR-025). The current, authoritative federation architecture
is described in `docs/federation.md`, `CLAUDE.md` (Tech Stack), and `docs/llm/facts.md`. The text
below is retained only as the original (now-historical) decision record.

## Context

Need ActivityPub implementation for inter-instance federation. Options: build from scratch, use fedify, use other AP libraries.

## Decision

Use Fedify with @fedify/sveltekit adapter, @fedify/postgres for key storage, @fedify/redis for queue.

## Rationale

- Fedify is the most complete TypeScript AP implementation
- Official SvelteKit adapter available
- Handles WebFinger, NodeInfo, HTTP signatures, key management
- Supports custom AP type extensions (needed for commonpub:Project, etc.)
- Active maintenance and good documentation

## Consequences

- Federation deferred until Phase 8 (after real content exists on two instances)
- Custom AP types defined in @commonpub/protocol protocol package
- Redis required for AP activity queue
- No federation before two instances have real content (Standing Rule #10)
