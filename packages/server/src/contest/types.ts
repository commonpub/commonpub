import type { ContestStatus, ContestStage, ContestStageSubmission, ContestImageMeta, ContestCoverPlacement } from '@commonpub/schema';
import type { DB } from '../types.js';

// Shared contest types — the single home for the contest module's interfaces so
// the logic modules (stages/entries/judging/submissions/crud) depend on types,
// not on each other for shapes. No runtime code lives here.

export type ContestJudgingVisibility = 'public' | 'judges-only' | 'private';
export type ContestVisibility = 'public' | 'unlisted' | 'private';

export interface ContestPrize {
  place?: number;
  category?: string;
  /** Optional — a prize can be description-only (no forced placement title). */
  title?: string;
  description?: string;
  value?: string;
}

export interface ContestJudgingCriterion {
  label: string;
  weight?: number;
  description?: string;
}

export interface CriterionScore {
  label: string;
  score: number;
  max: number;
}

export interface JudgeScoreEntry {
  judgeId: string;
  score: number;
  feedback?: string;
  criteriaScores?: CriterionScore[];
  /**
   * The review stage this score was given in (Phase B2.5 per-round isolation). A
   * judge has one score per round; the entry's live `score` aggregates only the
   * CURRENT round. Absent on pre-B2.5 scores (treated as a single bucket).
   */
  roundId?: string;
}

export interface ContestListItem {
  id: string;
  title: string;
  slug: string;
  subheading: string | null;
  description: string | null;
  bannerUrl: string | null;
  coverImageUrl: string | null;
  /** Non-destructive cover framing (P4); null ⇒ legacy cover fit. Listing cards
   *  apply it to the thumbnail. */
  coverMeta: ContestImageMeta | null;
  status: ContestStatus;
  startDate: Date;
  endDate: Date;
  entryCount: number;
  createdAt: Date;
}

export interface ContestDetail extends ContestListItem {
  subheading: string | null;
  rules: string | null;
  prizesDescription: string | null;
  /** Per-field render mode ('markdown' | 'html'), independent for each field. */
  descriptionFormat: 'markdown' | 'html';
  rulesFormat: 'markdown' | 'html';
  prizesDescriptionFormat: 'markdown' | 'html';
  /** Block-editor body (BlockTuple[]); when non-null the viewer renders these
   *  instead of the legacy description/rules text + format toggle. */
  descriptionBlocks: unknown[] | null;
  rulesBlocks: unknown[] | null;
  prizesBlocks: unknown[] | null;
  showPrizes: boolean;
  /** Non-destructive banner framing (P4); null ⇒ the legacy cover fit.
   *  (`coverMeta` is inherited from ContestListItem.) */
  bannerMeta: ContestImageMeta | null;
  /** Where the cover image renders on the public page; null ⇒ `about`. */
  coverPlacement: ContestCoverPlacement | null;
  prizes: ContestPrize[] | null;
  judgingCriteria: ContestJudgingCriterion[] | null;
  judgingVisibility: ContestJudgingVisibility;
  judgingEndDate: Date | null;
  communityVotingEnabled: boolean;
  eligibleContentTypes: string[] | null;
  maxEntriesPerUser: number | null;
  visibility: ContestVisibility;
  visibleToRoles: string[] | null;
  createdById: string;
  /** Phase B1 — explicit stage timeline (`[]` ⇒ classic synthesized flow). */
  stages: ContestStage[];
  currentStageId: string | null;
  /**
   * Per-request view-model flag (NOT persisted): whether the CURRENT viewer may
   * manage this contest — owner, a per-contest `editor` stakeholder, or a
   * `contest.manage` holder. Set by the contest GET route; undefined elsewhere.
   * Drives the client Edit/manage affordances (server remains the enforcement
   * boundary).
   */
  viewerCanManage?: boolean;
}

export interface ContestFilters {
  status?: ContestStatus;
  limit?: number;
  offset?: number;
}

export interface CreateContestInput {
  title: string;
  slug: string;
  subheading?: string;
  description?: string;
  rules?: string;
  prizesDescription?: string;
  descriptionFormat?: 'markdown' | 'html';
  rulesFormat?: 'markdown' | 'html';
  prizesDescriptionFormat?: 'markdown' | 'html';
  /** Block-editor body (BlockTuple[]) for overview/rules. */
  descriptionBlocks?: unknown[];
  rulesBlocks?: unknown[];
  prizesBlocks?: unknown[];
  showPrizes?: boolean;
  bannerUrl?: string;
  coverImageUrl?: string;
  /** Non-destructive banner/cover framing (P4). `null` clears it back to the
   *  legacy cover fit; `undefined` leaves it untouched on update. */
  bannerMeta?: ContestImageMeta | null;
  coverMeta?: ContestImageMeta | null;
  coverPlacement?: ContestCoverPlacement | null;
  prizes?: ContestPrize[];
  judgingCriteria?: ContestJudgingCriterion[];
  stages?: ContestStage[];
  currentStageId?: string;
  /** Seed-only: populates the contest_judges table at creation. */
  judges?: string[];
  communityVotingEnabled?: boolean;
  judgingVisibility?: ContestJudgingVisibility;
  eligibleContentTypes?: string[];
  maxEntriesPerUser?: number;
  visibility?: ContestVisibility;
  visibleToRoles?: string[];
  /** Seed-only: populates the contest_stakeholders table at creation. */
  stakeholders?: string[];
  startDate: string;
  endDate: string;
  judgingEndDate?: string;
  createdBy: string;
}

/** A contest-like object the pure stage helpers (stages.ts) operate on. */
export type StageSource = {
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  judgingEndDate: Date | string | null;
  stages?: ContestStage[] | null;
  currentStageId?: string | null;
};

export interface ContestEntryItem {
  id: string;
  contestId: string;
  contentId: string;
  userId: string;
  score: number | null;
  rank: number | null;
  /** Phase B2 — per-stage cohort outcome; `eliminated` is the derived convenience. */
  stageState: Array<{ stageId: string; status: 'advanced' | 'eliminated'; score?: number | null; rank?: number | null }>;
  eliminated: boolean;
  /**
   * Per-stage artifacts (proposal/prototype field values). Present only when
   * the caller asked for them (privileged viewers, or the entrant's own rows
   * via `stageSubmissionsViewerId`) — never on the public listing.
   */
  stageSubmissions?: ContestStageSubmission[];
  submittedAt: Date;
  // Enriched fields from joins
  contentTitle: string;
  contentSlug: string;
  contentType: string;
  /**
   * Backing content status (`published`/`draft`/`archived`/...). Drives the
   * entry-detail route's draft gate (a draft placeholder is 404'd for
   * non-owner/non-privileged viewers) and lets the client suppress the dead
   * "View the project" link when the content isn't public. Present on
   * `getContestEntry`; omitted by the public listing (which already filters
   * drafts out).
   */
  contentStatus?: string;
  /**
   * Backing content visibility (`public`/`members`/`private`). Drives the
   * entry-detail route's visibility gate (P-1b): a published-but-members/private
   * project submitted as an entry must be 404'd for non-owner/non-privileged
   * viewers, same as a draft. Present on `getContestEntry`; the public listing
   * already filters non-public entries out.
   */
  contentVisibility?: string;
  contentCoverImageUrl: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  judgeScores?: JudgeScoreEntry[];
}

/** An accepted agreement field, ready to be recorded as an acceptance row. */
export interface AgreementAcceptanceInput {
  fieldKey: string;
  label: string;
  terms: string;
  termsFormat: 'markdown' | 'html';
}

/**
 * The result of validating + partitioning a submission form. Agreements and PII
 * are split OUT of the public `artifact` so they never reach `stageSubmissions`:
 * agreements become immutable acceptance rows, PII lands in the private table.
 */
export interface PartitionedSubmission {
  /** Non-PII, non-agreement fields → the public `stageSubmissions` artifact. */
  artifact: Record<string, string>;
  /** PII fields (`pii: true` or `address`) → `contest_entry_private_fields`. */
  pii: Record<string, string>;
  /** Accepted agreements → `contest_agreement_acceptances`. */
  agreements: AgreementAcceptanceInput[];
}

export interface AdvanceStageInput {
  /** The `review` stage whose advancement cut we're applying. */
  reviewStageId: string;
  mode: 'topN' | 'manual';
  /** topN mode: how many of the eligible cohort advance (ties broken deterministically). */
  topN?: number;
  /** manual mode: explicit entry ids that advance; the rest of the cohort is eliminated. */
  advancedEntryIds?: string[];
}

/** The transaction handle drizzle passes to `db.transaction(async (tx) => …)`. */
export type ContestTx = Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * The per-instance context the contest email producers need to build a message:
 * the public site URL + name for links/branding and the AUTH_SECRET that signs
 * the per-recipient unsubscribe token. Supplied by the caller (route or worker)
 * so the pure server functions stay free of runtimeConfig.
 */
export interface ContestEmailContext {
  /** Public origin, e.g. `https://commonpub.io` (no trailing slash). */
  siteUrl: string;
  /** Human-readable instance name for the email header/subject. */
  siteName: string;
  /** AUTH_SECRET — signs the per-recipient one-click unsubscribe token. */
  secret: string;
}

/** One participant registered for a contest (audience for confirmation + reminders). */
export interface ContestRegistrantItem {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  registeredAt: Date;
}
