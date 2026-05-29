# 028 — Homepage / page customization model

**Status**: Accepted (session 168). Supersedes the implicit "three parallel models" status quo. Legacy-removal timing is gated on the federation "two real instances" milestone (Standing Rule #10).

## Context

A foundational audit (session 168) found **three coexisting, mutually-unaware** ways a page (esp. the homepage) gets customized:

1. **Hardcoded `.vue` override** — a thin app shadows a layer component (or `pages/index.vue`) via Nuxt layer shadowing. How deveco-io + heatsynclabs-io actually customize today (they shadow `HeroSection.vue` / `SiteLogo.vue`). Invisible to the layout engine; requires a redeploy to change.
2. **Legacy config** — `instance_settings.homepage.sections` (JSONB) → `HomepageSectionRenderer`. Operator-editable via `/admin/homepage`.
3. **Layout engine** — the `layouts` table → `LayoutSlot` + the `/admin/layouts` visual editor (Phase 1c–3e).

`pages/index.vue` picks **3 > 2 > 1-fallback** at runtime; the legacy `PUT /api/admin/homepage/sections` also has a bidirectional migrate-on-save hook into the layout table when the flag is on. Two further problems compound it: the page **frame** (zone arrangement + sizing) was duplicated/divergent across pages + the editor (fixed by `<PageFrame>` — see ADR 027 + session 168), and the registry's section→component wiring **bypasses thin-app component shadowing** (explicit imports resolve to the layer; see `feedback-nuxt-resolvecomponent-static-only`).

Strategic read: the layout engine (~12k LOC) is a bet on **non-technical operators**, while today's operators are **developer-operators** who customize by code/shadowing — which model 3 partly fights.

## Decision

**Two sanctioned models; deprecate the third.**

- **Developers customize via code** — component shadowing / `.vue` overrides (model 1). First-class + permanent. This is how an engineering-led instance (deveco/heatsync) tailors its UI.
- **Operators customize via the layout engine** — DB layouts + visual editor (model 3). First-class for non-technical instances.
- **Legacy `homepage.sections` (model 2) is DEPRECATED** — superseded by the layout engine. Kept working for back-compat (and as the no-layout fallback) until the layout engine is proven on ≥2 real instances; then remove the legacy renderer + the bidirectional-sync seam in `admin/homepage/sections.put.ts`.

**The two sanctioned models MUST compose.** A thin app that shadows a section's component must have that shadow honored under the layout engine — i.e. the registry must resolve section components through Nuxt (shadow-aware), not via hard imports. Until that lands (a literal-keyed resolver; `feedback-nuxt-resolvecomponent-static-only`), a shadowing instance gets its overrides on the legacy/file-route path but NOT under the layout engine — a known gap, not the intended end state.

**One frame for render + edit.** All pages + the editor canvas arrange zones through the single `<PageFrame>` (session 168), so the editor previews exactly what renders.

## Consequences

- **Migration path off legacy:** an instance on `homepage.sections` flips `features.layoutEngine` on → `migrate-homepage` (idempotent, non-destructive) seeds a layout 1:1 from the legacy config → the page renders via the layout engine with no visible change (the "canary contract"). Once on the engine, the legacy form is read-only history.
- **Removal (gated on 2-instance milestone):** delete `HomepageSectionRenderer` + the legacy branch in `index.vue` + the migrate-on-save hook; `homepage.sections` becomes a one-time import source only.
- **Shadowing fix is now a committed direction**, not optional — it's what lets the "developers customize via code" model coexist with the engine. Verify with a real thin app (deveco/heatsync), not in the base repo alone.
- **Frame variants (Phase 4)** parameterize `PageFrame`'s `--cpub-frame-*` tokens (narrow / wide / sidebar-left) via `pageMeta.frame`.

## Alternatives rejected

- **Engine-only (drop code overrides):** breaks the developer-operator workflow that real instances depend on today.
- **Keep all three forever:** the conceptual + maintenance cost (the bidirectional-sync seam, the 3-way `index.vue` branch) is the debt this ADR retires.
- **Make the layout engine able to import arbitrary hardcoded `.vue` pages:** not feasible (a hardcoded page isn't section-structured); out of scope.

## Links
- ADR 027 — layout engine architecture
- `docs/sessions/168-consolidation.md` — the audit + PageFrame consolidation
- `feedback-nuxt-resolvecomponent-static-only`, `feedback-reuse-existing-components`
