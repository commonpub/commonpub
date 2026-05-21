# Session 152 — Universal `border-radius` leak on deveco code blocks

**Date:** 2026-05-21
**Layer:** 0.21.20 → **0.21.21** (shipped)
**Sites:** commonpub.io, deveco.io, heatsynclabs.io

## What the user reported

> "deveco.io still has these weird codeblocks. wtf"

Screenshots showed JSON + C code blocks rendering as **two visually separate dark rounded rectangles** — a "Copy" button bar at top, a clear gap of page-bg below, then the code block proper. The session-150 fix for the prose-style leak (`border: 0 !important` on `.cpub-code-body`) was confirmed deployed in the served CSS, yet the visual gap persisted.

## Root cause

`layers/base/theme/base.css:239-244` applies the theme's `--radius` to every element:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  border-radius: var(--radius);   /* ← the culprit */
}
```

Theme `--radius` values on the wire (post-cascade):
| Site | `--radius` |
|------|-----------|
| heatsynclabs.io | `0px` |
| commonpub.io | `0px` |
| deveco.io | `6px` |

On heatsync/commonpub.io the universal rule is a visual no-op. On deveco it rounds the corners of **every** element on the page — including the inner `.cpub-code-header` and `.cpub-code-body` of `BlockCodeView`.

Inside the outer `.cpub-block-code` (which has `border + overflow: hidden + border-radius: 6px`):
- Header's bottom corners curve **away from** the body below
- Body's top corners curve **away from** the header above
- Both backgrounds stop at their rounded edge
- The outer container has no background → page-bg shows through the wedges
- Visual: "floating bar with gap then code block"

The outer `overflow: hidden` clips only the **outer** corners of the children to the parent's rounded shape. The **inner** corners (between header and body) are not clipped because nothing is there to clip them.

## Components vulnerable to the same pattern

Any multi-section block component with outer container `overflow: hidden` + inner sections with backgrounds. Audit found 7:

1. `BlockCodeView` — `.cpub-code-header` + `.cpub-code-body` (reported)
2. `BlockPartsListView` — `.cpub-parts-header` + `th` + `td`
3. `BlockVideoView` — `.cpub-video-label` + `.cpub-video-wrap`
4. `BlockEmbedView` — `.cpub-embed-label` + `.cpub-embed-wrap`
5. `BlockDownloadsView` — `.cpub-dl-header` + `.cpub-dl-item`
6. `BlockToolListView` — `.cpub-tools-header`
7. `BlockBuildStepView` — `.cpub-step-header`

## Fix (0.21.21)

Per-component reset: explicit `border-radius: 0` on each inner-section selector. The outer container keeps its theme-driven rounding; inner sections tile flush against each other via the parent's overflow:hidden clip.

No `!important` needed — scoped `.foo[data-v-xxx]` selectors at specificity (0,2,0) trivially beat the universal `*` rule at (0,0,0).

`BlockBuildStepView`'s `.cpub-step-num` (28×28 number badge) was **not** reset — auto-rounding to 6px on deveco looks intentional for a badge. Only the rectangular sections matter.

## Why not remove the universal rule

Tempting (it's the root cause) but the blast radius is hard to predict. Deveco's theme likely relies on the implicit rounding for divs/elements that don't set `border-radius` explicitly. Removing the universal rule would make those random divs sharp, breaking deveco's intended rounded look across the whole site. The per-component fix is targeted and reversible. Filed as known-quirk in `feedback_universal_radius_leak.md`.

## Decisions

- **Stack the resets**: `border: 0 !important` (from prose-style fix, 0.21.20) + `border-radius: 0` (this fix, 0.21.21) co-exist on the same selectors. Each defeats a different leak source.
- **No `!important` on the radius reset**: specificity wins cleanly. `!important` is only needed when the global rule and the scoped rule address different sets of properties (the prose `border` case).
- **Skip removing the universal `border-radius` rule**: documented as a known pitfall, not a bug to fix.

## What shipped

| Package | Before | After | Channel |
|---------|--------|-------|---------|
| `@commonpub/layer` | 0.21.20 | **0.21.21** | npm latest |

Thin apps bumped + redeployed:
- `deveco-io` — commit `9a13e5d`, push triggered `Deploy Production` workflow_id `26212030841`
- `heatsynclabs-io` — commit `e8a4270`, workflow_id `26212045019` (WIP `commonpub.config.ts` federation-flag flip preserved untouched)
- `commonpub-io` (this monorepo) — commit `c798344`, workflow_id `26212061041`

## Open

- **WIP on heatsync `commonpub.config.ts`** — federation flag flipped to `true` + `auto-accept` follow policy, uncommitted. Looks like in-progress P3 work from earlier sessions. **Not** committed by this session.
- **`BlockMathView` prose-pre leak** — still latent from session 150 P8. Doesn't get the wedge-gap symptom (no header+body structure), but does get leaked background + border from `.cpub-prose pre`. Math blocks rare, deferred.

## Verification approach

User-visible verification will need a browser check on deveco. Wire-level verification via curl is captured in the verification step (post-deploy):

```bash
curl -sS 'https://deveco.io/u/netburner/project/how-to-connect-an-embedded-system-to-aws-iot-core-with-mqtt' \
  | grep -oE '\.cpub-code-header\[data-v-[a-f0-9]+\][^{]*\{[^}]+\}'
# Expect: ...;border-radius:0
```
