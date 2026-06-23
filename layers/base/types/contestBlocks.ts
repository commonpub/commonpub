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

/** A single logo in the `sponsors` block. */
export interface SponsorLogo {
  /** Logo image URL (uploaded or pasted). */
  src: string;
  /** Accessible name — the organization, used as the img alt. */
  alt: string;
  /** Optional outbound link (http(s) only when rendered). */
  url?: string;
  /** Optional tier label, e.g. "Gold". Logos sharing a tier render in one group. */
  tier?: string;
}

/**
 * `sponsors` block — a logo wall for partners/sponsors. Flat list of logos with an
 * optional eyebrow heading; logos that share a `tier` group together (the view
 * shows the tier labels only when at least one logo is tiered).
 */
export interface SponsorsContent {
  /** Eyebrow heading above the wall, e.g. "Sponsors". */
  heading?: string;
  logos: SponsorLogo[];
}

export const SPONSORS_TYPE = 'sponsors';

/** Tone of a `compareColumns` column — drives its color + per-item icon. */
export type CompareTone = 'positive' | 'negative' | 'neutral';

/** One column in the `compareColumns` block. */
export interface CompareColumn {
  tone: CompareTone;
  /** Column title, e.g. "Encouraged" / "Out of scope". */
  title: string;
  /** Bullet items (plain text). */
  items: string[];
}

/**
 * `compareColumns` block — side-by-side guidance columns (the classic
 * "Encouraged / Out of scope" or do-vs-don't pattern), with an optional eyebrow,
 * heading, and a footer note.
 */
export interface CompareColumnsContent {
  /** Eyebrow label above the heading, e.g. "What is in scope". */
  eyebrow?: string;
  /** Heading line. */
  heading?: string;
  columns: CompareColumn[];
  /** Optional footer note shown under the columns. */
  note?: string;
}

export const COMPARE_COLUMNS_TYPE = 'compareColumns';

/** Visual emphasis of a roadmap node — default (hollow), accent (filled), highlight (finale). */
export type RoadmapTone = 'default' | 'accent' | 'highlight';

/** One milestone on the `roadmap` timeline. */
export interface RoadmapItem {
  /** Free-text date label, e.g. "Jun 30" (organizer-editable, not a real date). */
  date?: string;
  title: string;
  /** Plain-text blurb under the title. */
  description?: string;
  /** Optional pill next to the date, e.g. "Mid-term". */
  badge?: string;
  tone?: RoadmapTone;
}

/**
 * `roadmap` block — a vertical schedule timeline. The edit block can seed its
 * items from the contest's stages/schedule (one click), then the organizer edits,
 * reorders, and styles them freely; the saved items are independent of the live
 * stages (present-how-you-like).
 */
export interface RoadmapContent {
  /** Eyebrow label, e.g. "Key dates, 2026". */
  eyebrow?: string;
  /** Heading line, e.g. "The 18-week roadmap". */
  heading?: string;
  items: RoadmapItem[];
}

export const ROADMAP_TYPE = 'roadmap';
