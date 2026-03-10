# ADR-008: Turborepo + pnpm Monorepo

## Status
Accepted

## Context
Need monorepo tooling for 10+ packages, apps, and tools. deveco-io already uses Turborepo + pnpm successfully.

## Decision
Turborepo for task orchestration, pnpm for package management, workspace protocol for internal dependencies.

## Rationale
- Turborepo provides caching, parallel execution, and dependency-aware task ordering
- pnpm is fast, disk-efficient, and enforces proper dependency declarations
- deveco-io's turbo.json and pnpm-workspace.yaml provide proven patterns
- workspace:* protocol for internal package references

## Consequences
- All packages under packages/, apps under apps/, tools under tools/
- turbo.json defines build, dev, test, lint, typecheck, clean pipelines
- CI uses pnpm install --frozen-lockfile
- New packages must be added to pnpm-workspace.yaml
