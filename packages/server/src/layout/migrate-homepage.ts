/**
 * Legacy homepage migration — converts the configurable
 * `instance_settings.homepage.sections` JSON into a real layout row.
 *
 * Why this exists (vs. the simpler `seedHomepageLayout` from session 158):
 *   - `seedHomepageLayout` creates a stub layout (hero + content-feed only).
 *     Useful for fresh instances bootstrapping the layout engine; not
 *     useful for established instances that have customised
 *     `homepage.sections` with 5–10 sections.
 *   - This function reads the operator's existing customisation and
 *     produces a layout row that matches the rendered legacy homepage
 *     1-for-1: same sections, same zones, same order.
 *   - Once successful, flipping `features.layoutEngine: true` becomes
 *     a no-visible-change operation. That's the canary contract.
 *
 * Zone mapping mirrors `HomepageSectionRenderer.vue` (the legacy
 * dispatcher) exactly:
 *   - FULL_WIDTH = {hero}
 *   - SIDEBAR    = {stats, contests, hubs}
 *   - MAIN       = everything else
 *
 * Type mapping for type-renames (Phase 6b will collapse these aliases):
 *   - `content-grid`     → `content-feed`  (same query shape)
 *   - `content-carousel` → `content-feed`  (no carousel section yet)
 *   - All other types map 1:1 (hero, editorial, contests, hubs, stats,
 *     learning, custom-html)
 *
 * Visibility:
 *   - Per-section `visibility.features` set for types that have a
 *     feature-flag gate. This makes a placed `contests` section hide
 *     entirely when `features.contests` is off (LayoutSlot honours it),
 *     matching the legacy `isFeatureEnabled(featureGate)` skip in
 *     `HomepageSectionRenderer.vue:42`.
 *
 * Idempotent: by default, returns `{migrated:false, reason:
 * 'layout-already-exists', layoutId}` when a layout already exists at
 * scope `('route', '/')`. Pass `force: true` to replace it (an admin
 * UI "re-run migration" affordance would set this).
 */
import { sql } from 'drizzle-orm';
import { saveLayout, publishLayout, getLayoutByScope, deleteLayout } from './layout.js';
import type { LayoutInput, LayoutRowInput, LayoutSectionInput, LayoutZoneInput } from './layout.js';
import type { DB } from '../types.js';

// ---- Result + options ---------------------------------------------------

export type MigrateHomepageReason =
  | 'no-legacy-data'
  | 'layout-already-exists'
  | 'no-enabled-sections';

export interface MigrateHomepageResult {
  /** True if a new layout was created from the legacy sections. */
  migrated: boolean;
  /** Layout id (existing or newly created). Absent only when no layout exists in either state. */
  layoutId?: string;
  /** Number of legacy sections converted to layout sections. */
  sectionsConverted: number;
  /** Number of legacy sections that were skipped (disabled, unknown type). */
  sectionsSkipped: number;
  /** Per-skip reasons keyed by legacy section id (for operator audit). */
  skipReasons?: Record<string, 'disabled' | 'unknown-type'>;
  /** Reason for not migrating (set when `migrated: false`). */
  reason?: MigrateHomepageReason;
}

export interface MigrateHomepageOptions {
  /** User id to attribute creation + publish to (set in createdBy/publishedBy). */
  adminId?: string;
  /**
   * Replace an existing layout at `('route','/')` instead of skipping.
   * Used by admin UI's "re-run migration" affordance. Cascades through
   * rows + sections + versions per `deleteLayout`'s FK behavior.
   */
  force?: boolean;
}

// ---- Legacy section shape -----------------------------------------------

/**
 * Loose shape — operators may have hand-edited `homepage.sections` JSON
 * over time. We treat every field as optional + best-effort, with the
 * mapper logging skip reasons rather than throwing on a single bad entry.
 */
interface LegacyHomepageSection {
  id?: string;
  type?: string;
  order?: number;
  title?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

// ---- Mapping tables -----------------------------------------------------

/** Legacy type slug → registered section type slug. */
const TYPE_MAP: Record<string, string> = {
  hero: 'hero',
  editorial: 'editorial',
  'content-grid': 'content-feed',         // shape-equivalent
  'content-carousel': 'content-feed',     // no carousel section yet — degrade
  contests: 'contests',
  hubs: 'hubs',
  learning: 'learning',
  stats: 'stats',
  'custom-html': 'custom-html',
};

/** Section types that go in the full-width zone (above the 2-col split). */
const FULL_WIDTH_TYPES = new Set(['hero']);

/** Section types that go in the sidebar zone. */
const SIDEBAR_TYPES = new Set(['stats', 'contests', 'hubs']);

/** Feature flags each type requires to render. Empty = no gate. */
const REQUIRED_FEATURES: Record<string, string[]> = {
  contests: ['contests'],
  hubs: ['hubs'],
  learning: ['learning'],
};

// ---- Per-type config mappers ---------------------------------------------

/**
 * Build a registered section's config from a legacy section. Each new
 * section type has a default-filled config; we lay the legacy values on
 * top, dropping unknown keys.
 *
 * The legacy `title` field (top-level) maps to the new `config.heading`.
 * Legacy `featureGate` lives inside `config` and is read separately for
 * the visibility wiring — not copied into the new config.
 */
function buildConfig(newType: string, legacy: LegacyHomepageSection): Record<string, unknown> {
  const legacyConfig = legacy.config ?? {};
  const heading = legacy.title ?? '';

  switch (newType) {
    case 'hero':
      // The legacy "hero" type in HomepageSectionRenderer was the
      // top-of-page banner with title/subtitle/eyebrow/cta. Operators may
      // have only set `variant`. Default the rest to the registered
      // section's defaults so the section renders with stock copy if the
      // legacy config didn't include text.
      return {
        variant: (legacyConfig.variant as string) ?? 'default',
        eyebrow: (legacyConfig.eyebrow as string) ?? '',
        title: (legacyConfig.title as string) ?? heading ?? 'Welcome',
        subtitle: (legacyConfig.subtitle as string) ?? '',
        ctas: Array.isArray(legacyConfig.ctas) ? legacyConfig.ctas : [],
      };

    case 'editorial':
      return {
        heading: heading || 'Staff Picks',
        limit: clamp((legacyConfig.limit as number) ?? 3, 1, 12),
        columns: clampToColumns((legacyConfig.columns as number) ?? 3),
      };

    case 'content-feed':
      return {
        heading: heading || '',
        contentType: (legacyConfig.contentType as string) ?? '',
        sort: ((legacyConfig.sort as string) ?? 'recent') as
          'recent' | 'popular' | 'featured' | 'editorial',
        limit: clamp((legacyConfig.limit as number) ?? 12, 1, 24),
        columns: clampToColumns((legacyConfig.columns as number) ?? 3),
        tag: (legacyConfig.tag as string) ?? '',
        featured: (legacyConfig.featured as boolean) ?? false,
      };

    case 'stats':
      return { heading: heading || 'Platform Stats' };

    case 'hubs':
      return {
        heading: heading || 'Trending Hubs',
        limit: clamp((legacyConfig.limit as number) ?? 4, 1, 20),
      };

    case 'contests':
      return {
        heading: heading || 'Active Contests',
        limit: clamp((legacyConfig.limit as number) ?? 3, 1, 10),
      };

    case 'learning':
      return {
        heading: heading || 'Learning Paths',
        limit: clamp((legacyConfig.limit as number) ?? 6, 1, 12),
        columns: clampToColumns((legacyConfig.columns as number) ?? 3),
      };

    case 'custom-html':
      return {
        heading: heading || '',
        html: (legacyConfig.html as string) ?? '',
      };

    default:
      // Unreachable — TYPE_MAP keys are the only types passed here, and
      // every key has a case branch. Fall through to a safe empty config.
      return { heading };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function clampToColumns(n: number): 1 | 2 | 3 | 4 {
  const c = clamp(Math.round(n), 1, 4);
  return c as 1 | 2 | 3 | 4;
}

// ---- The migration -------------------------------------------------------

/**
 * Read `instance_settings.homepage.sections`, convert to a layout row,
 * save + publish. See module header for behavior contract.
 */
export async function migrateHomepageSectionsToLayout(
  db: DB,
  opts: MigrateHomepageOptions = {},
): Promise<MigrateHomepageResult> {
  // 1. Read legacy data — direct SQL because instance_settings doesn't
  //    have a server-package helper today. Single row by `key` column.
  const rows = await db.execute<{ value: unknown }>(
    sql`SELECT value FROM instance_settings WHERE key = 'homepage.sections' LIMIT 1`,
  );
  // node-postgres returns { rows: [...] }; pglite returns the array
  // directly. Handle both shapes.
  const allRows: Array<{ value: unknown }> =
    Array.isArray(rows) ? rows :
    Array.isArray((rows as { rows?: unknown[] }).rows) ? (rows as { rows: Array<{ value: unknown }> }).rows :
    [];

  const legacyValue = allRows[0]?.value;
  if (!legacyValue || !Array.isArray(legacyValue)) {
    return { migrated: false, sectionsConverted: 0, sectionsSkipped: 0, reason: 'no-legacy-data' };
  }
  const legacySections = legacyValue as LegacyHomepageSection[];

  // 2. Idempotency check — existing layout at ('route','/').
  const existing = await getLayoutByScope(db, { type: 'route', path: '/' });
  if (existing && !opts.force) {
    return {
      migrated: false,
      layoutId: existing.id,
      sectionsConverted: 0,
      sectionsSkipped: 0,
      reason: 'layout-already-exists',
    };
  }
  if (existing && opts.force) {
    // Cascade-delete via FK; replaces with a fresh saveLayout below.
    await deleteLayout(db, existing.id);
  }

  // 3. Filter + map legacy sections.
  const skipReasons: Record<string, 'disabled' | 'unknown-type'> = {};
  type MappedSection = { newType: string; legacy: LegacyHomepageSection };
  const mapped: MappedSection[] = [];

  for (const legacy of legacySections) {
    const id = legacy.id ?? `unknown-${Math.random().toString(36).slice(2, 8)}`;
    if (legacy.enabled === false) {
      skipReasons[id] = 'disabled';
      continue;
    }
    const legacyType = legacy.type ?? '';
    const newType = TYPE_MAP[legacyType];
    if (!newType) {
      skipReasons[id] = 'unknown-type';
      continue;
    }
    mapped.push({ newType, legacy });
  }

  if (mapped.length === 0) {
    return {
      migrated: false,
      sectionsConverted: 0,
      sectionsSkipped: legacySections.length,
      skipReasons,
      reason: 'no-enabled-sections',
    };
  }

  // 4. Group by zone, preserving legacy `order`. Within a zone, sections
  //    are ordered by legacy.order (or array position if no order set).
  //    Typed as a `Map` so TS knows every key access is defined for the
  //    three known zones we initialise (vs. `Record`'s index signature
  //    return type of `T | undefined`).
  const byZone = new Map<'full-width' | 'main' | 'sidebar', MappedSection[]>([
    ['full-width', []],
    ['main', []],
    ['sidebar', []],
  ]);
  for (const m of mapped) {
    const zone: 'full-width' | 'main' | 'sidebar' =
      FULL_WIDTH_TYPES.has(m.newType) ? 'full-width' :
      SIDEBAR_TYPES.has(m.newType) ? 'sidebar' :
      'main';
    byZone.get(zone)!.push(m);  // ! safe — Map was initialised with all 3 keys above
  }
  for (const list of byZone.values()) {
    list.sort((a, b) => (a.legacy.order ?? 0) - (b.legacy.order ?? 0));
  }

  // 5. Build the LayoutInput. One row per zone, all sections of that zone
  //    sit in that one row at colSpan 12 (each takes the full zone width
  //    — matches the legacy single-column-per-zone render).
  const zones: LayoutZoneInput[] = [];
  for (const zoneName of ['full-width', 'main', 'sidebar'] as const) {
    const list = byZone.get(zoneName)!;
    if (list.length === 0) continue;

    const sections: LayoutSectionInput[] = list.map((m, idx) => {
      const requiredFeatures = REQUIRED_FEATURES[m.newType];
      const section: LayoutSectionInput = {
        order: idx,
        type: m.newType,
        config: buildConfig(m.newType, m.legacy),
        colSpan: 12,
        enabled: true,
        schemaVersion: 1,
      };
      if (requiredFeatures) {
        section.visibility = { features: requiredFeatures };
      }
      return section;
    });

    const row: LayoutRowInput = {
      order: 0,
      config: { gap: zoneName === 'full-width' ? 'none' : 'md' },
      sections,
    };
    zones.push({ zone: zoneName, rows: [row] });
  }

  const input: LayoutInput = {
    scope: { type: 'route', path: '/' },
    name: 'Homepage (migrated from legacy)',
    pageMeta: { title: 'Homepage', access: 'public' },
    state: 'draft',  // publishLayout below flips to published
    zones,
  };

  // 6. Save + publish atomically. publishLayout takes a snapshot into
  //    layout_versions so the operator can revert if needed.
  const saved = await saveLayout(db, input, { userId: opts.adminId });
  await publishLayout(db, saved.id, { publishedBy: opts.adminId });

  const sectionsConverted = mapped.length;
  const sectionsSkipped = legacySections.length - sectionsConverted;

  return {
    migrated: true,
    layoutId: saved.id,
    sectionsConverted,
    sectionsSkipped,
    skipReasons: Object.keys(skipReasons).length > 0 ? skipReasons : undefined,
  };
}
