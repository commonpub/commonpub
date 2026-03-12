# ADR-007: Feature Flags via commonpub.config.ts

## Status

Accepted

## Context

Different CommonPub instances will want different feature sets. Need a way to enable/disable major features without code changes.

## Decision

All features gated behind flags in `commonpub.config.ts` via `defineCommonPubConfig()`. Standing Rule #2: "No feature without a flag."

## Rationale

- Instance operators choose their feature set at deploy time
- Features disabled at config level don't load routes, migrations, or UI
- Type-safe config with Zod validation and helpful warnings
- Feature flags: communities, docs, video, contests, learning

## Consequences

- @commonpub/config provides defineCommonPubConfig() factory
- Schema migrations are feature-flag-aware (skip tables for disabled features)
- SvelteKit routes conditionally registered based on flags
- UI components check feature flags before rendering feature-specific content
