# ADR-004: Fedify for ActivityPub Federation

## Status
Accepted

## Context
Need ActivityPub implementation for inter-instance federation. Options: build from scratch, use fedify, use other AP libraries.

## Decision
Use Fedify with @fedify/sveltekit adapter, @fedify/postgres for key storage, @fedify/redis for queue.

## Rationale
- Fedify is the most complete TypeScript AP implementation
- Official SvelteKit adapter available
- Handles WebFinger, NodeInfo, HTTP signatures, key management
- Supports custom AP type extensions (needed for snaplify:Project, etc.)
- Active maintenance and good documentation

## Consequences
- Federation deferred until Phase 8 (after real content exists on two instances)
- Custom AP types defined in @snaplify/snaplify protocol package
- Redis required for AP activity queue
- No federation before two instances have real content (Standing Rule #10)
