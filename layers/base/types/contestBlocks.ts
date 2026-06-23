/**
 * Contest-specific block content shapes (BlockTuple content objects).
 *
 * These blocks live ENTIRELY in the layer: the edit component is provided to
 * BlockCanvas via `BLOCK_COMPONENTS_KEY` (no @commonpub/editor change — the
 * editor registry is unused; component resolution is `override ?? builtin ??
 * TextBlock`), and the view component is registered in BlockContentRenderer's
 * map. Persistence rides the contest `descriptionBlocks`/`rulesBlocks` jsonb
 * (validated loosely as `BlockTuple[]`), so no registry/schema wiring is needed.
 */

/** A single judge/mentor card in the `judgesShowcase` block. */
export interface JudgeShowcaseEntry {
  name: string;
  /** Avatar image URL (falls back to the name initial). */
  avatarUrl?: string;
  /** Role / affiliation line, e.g. "Lead Judge, ACME Labs". */
  title?: string;
  /** Short bio / description. */
  bio?: string;
  /** Optional profile or external link (http(s) only when rendered). */
  link?: string;
}

/**
 * `judgesShowcase` block — an editorial judges/mentors showcase for the contest
 * overview (avatar + name + bio), curated independently of the `contest_judges`
 * table / Judges tab.
 */
export interface JudgesShowcaseContent {
  /** Optional section heading, e.g. "Meet the Judges". */
  heading?: string;
  judges: JudgeShowcaseEntry[];
}

/** Block type key shared by the edit component (provide map) + the view (renderer map). */
export const JUDGES_SHOWCASE_TYPE = 'judgesShowcase';
