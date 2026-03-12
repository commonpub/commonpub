# ADR 024: Rename snaplify → CommonPub

## Status
Accepted (2026-03-11)

## Context
The project needed a name that better reflects its purpose as an open ActivityPub federation protocol for maker communities. "Snaplify" was a working name that didn't communicate the project's identity.

## Decision
Rename the entire project from "snaplify" to "CommonPub":
- All package scopes: `@snaplify/*` → `@commonpub/*`
- Types: `SnaplifyConfig` → `CommonPubConfig`, `SnaplifyActor` → `CommonPubActor`
- Functions: `defineSnaplifyConfig` → `defineCommonPubConfig`
- CSS prefix: `snaplify-` → `cpub-`
- Special case: `@snaplify/snaplify` (protocol package) → `@commonpub/protocol`

## Consequences
- 481 files modified in the rename
- All imports, types, CSS classes, config references, docs, and deploy configs updated
- Git history preserved (rename tracked as modifications, not delete+create)
- `pre-commonpub-rename` tag marks the last commit under the old name
