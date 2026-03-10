# ADR-007: Feature Flags via snaplify.config.ts

## Status
Accepted

## Context
Different Snaplify instances will want different feature sets. Need a way to enable/disable major features without code changes.

## Decision
All features gated behind flags in `snaplify.config.ts` via `defineSnaplifyConfig()`. Standing Rule #2: "No feature without a flag."

## Rationale
- Instance operators choose their feature set at deploy time
- Features disabled at config level don't load routes, migrations, or UI
- Type-safe config with Zod validation and helpful warnings
- Feature flags: communities, docs, video, contests, learning

## Consequences
- @snaplify/config provides defineSnaplifyConfig() factory
- Schema migrations are feature-flag-aware (skip tables for disabled features)
- SvelteKit routes conditionally registered based on flags
- UI components check feature flags before rendering feature-specific content
