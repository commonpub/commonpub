/**
 * Section registry types — the contract for a layout section.
 *
 * A section is what an admin drops onto the canvas in `/admin/pages`.
 * Each section type ships:
 *   - metadata (name, icon, category, description)
 *   - a Zod schema for its config — drives the auto-generated form
 *     (`docs/plans/layout-and-pages.md` §7.10)
 *   - a default config for "just added" state
 *   - colSpan bounds (resize is clamped to `[minColSpan, maxColSpan]`)
 *   - a Vue renderer
 *   - optional config-schema migrations (lazy on read)
 *
 * Registries are LOADED THE SAME on server and client — they're a config
 * + import map. Built-in sections register at layer startup; future
 * code-registered sections (plan §3.1, Phase 9) register via the thin
 * app's `commonpub.config.ts` `sections:` array.
 *
 * This module is pure TypeScript + types; the Vue runtime registry that
 * holds the actual `Component` refs lives in `layers/base/sections/registry.ts`
 * (next session, Phase 1 continuation).
 */
import type { Component } from 'vue';
import type { ZodType } from 'zod';

/** Section category — drives palette grouping. */
export type SectionCategory =
  | 'layout'        // hero, divider, spacer, container
  | 'content'       // heading, paragraph, image, gallery, video
  | 'data'          // content-feed, hub-list, contest-list, member-list, stats-grid
  | 'interactive'  // cta, contact-form, newsletter, comment-thread
  | 'editorial'     // announcement, banner, staff-picks
  | 'embed'         // oEmbed, iframe, custom-html
  | 'custom';       // catch-all for thin-app-registered sections

/** Lifecycle / visibility tag — orthogonal to category. */
export type SectionStatus = 'stable' | 'beta' | 'deprecated';

/**
 * Full section definition. TConfig is the type of the section's config
 * blob — Zod schema validates it, the renderer consumes it.
 */
export interface SectionDefinition<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique slug. Used in `LayoutSection.type` + routes. Must be kebab-case. */
  type: string;
  /** Display name shown in the palette + inspector. */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  /** Font Awesome icon class (e.g. `'fa-image'`). */
  icon: string;
  /** Category for palette grouping. */
  category: SectionCategory;
  /** Lifecycle flag. Beta sections show a badge; deprecated ones warn on add. */
  status?: SectionStatus;
  /** Zod schema for the section's `config` blob. Drives auto-form generation. */
  configSchema: ZodType<TConfig>;
  /** Default config when the section is first dropped onto the canvas. */
  defaultConfig: TConfig;
  /** Current schema version. Bump when configSchema breaks. */
  schemaVersion: number;
  /**
   * Renderer Vue component. Default contract: receives
   * `{ config: TConfig; meta: SectionRenderMeta }`. Override the prop
   * shape via `propMap` (below) when pointing at an existing reusable
   * component (e.g. a Block*View or a homepage *Section.vue) that has
   * its own established prop contract.
   */
  component: Component;
  /**
   * Optional prop transform — maps the standard `{config, meta}` shape
   * to whatever the target `component` actually expects. Use this when
   * reusing an existing component (Block*View takes `{content}`;
   * HeroSection.vue takes `{config: HomepageSectionConfig}`; etc.) so
   * we don't write redundant Section*.vue adapters.
   *
   * Default: identity — passes `{config, meta}` unchanged.
   *
   * Example:
   *   component: BlockHeadingView,
   *   propMap: ({ config }) => ({ content: config }),
   *
   * Lesson from session 159: layout engine = arranger for existing
   * components. See `feedback-reuse-existing-components` memory +
   * `docs/plans/stage-e-unification.md`.
   *
   * Type note: NOT tied to TConfig — most propMaps just route config
   * without caring about its specific shape, and tying to TConfig
   * makes SectionDefinition incompatible with spread+override patterns
   * (test fixtures pulling a base def into a different TConfig).
   * configSchema validates the shape at runtime.
   */
  propMap?: (props: { config: Record<string, unknown>; meta: SectionRenderMeta }) => Record<string, unknown>;
  /** Optional migrations: oldVersion → newConfig. */
  migrations?: Record<number, (oldConfig: Record<string, unknown>) => TConfig>;
  /** Feature flag that must be ON for this section to appear in the palette. */
  featureGate?: string;
  /** Which zones this section is allowed in. Default: all zones the page declares. */
  allowedZones?: string[];
  /** Roles that can ADD this section in the editor (different from runtime visibility). */
  addRoles?: ('staff' | 'admin')[];
  /** Minimum colSpan this section's content tolerates (resize floor). */
  minColSpan: number;
  /** Maximum colSpan. Almost always 12. Set lower if the section breaks at full width. */
  maxColSpan: number;
  /** Initial colSpan when dropped into a row. Must satisfy [minColSpan, maxColSpan]. */
  defaultColSpan: number;
  /** Whether the section can be resized. False = always `defaultColSpan`. */
  resizable: boolean;
  /** Preview screenshot URL — shown in the palette tile if present. */
  previewImage?: string;
}

/** Props the registered Vue component receives on render. */
export interface SectionRenderProps<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  config: TConfig;
  meta: SectionRenderMeta;
}

/** Context passed to a section renderer at runtime. */
export interface SectionRenderMeta {
  /** The route this layout is for ('/', '/about', etc.) — useful for canonical links. */
  route: string;
  /** Zone slug the section is being rendered in. */
  zone: string;
  /** Whether this render is happening inside the editor preview (skip side effects). */
  isPreview: boolean;
  /** Resolved colSpan for the current viewport. */
  effectiveColSpan: number;
  /** Section's stable id — useful for analytics + a11y labelling. */
  sectionId: string;
}

/**
 * In-memory section registry. The layer registers built-in sections at
 * startup; thin apps register their own via `commonpub.config.ts` →
 * registered on the Nuxt plugin load.
 *
 * A new registry instance is created per process (server + client each
 * have their own); for SSR/hydration parity, the SAME registration code
 * runs on both sides.
 */
export class SectionRegistry {
  private entries = new Map<string, SectionDefinition>();

  /** Register a section. Throws on type collision (registration is fail-fast). */
  register<TConfig extends Record<string, unknown>>(def: SectionDefinition<TConfig>): void {
    if (this.entries.has(def.type)) {
      throw new Error(`Section type "${def.type}" is already registered`);
    }
    if (def.minColSpan < 1 || def.minColSpan > 12) {
      throw new Error(`Section "${def.type}": minColSpan must be 1-12, got ${def.minColSpan}`);
    }
    if (def.maxColSpan < def.minColSpan || def.maxColSpan > 12) {
      throw new Error(`Section "${def.type}": maxColSpan must be ${def.minColSpan}-12, got ${def.maxColSpan}`);
    }
    if (def.defaultColSpan < def.minColSpan || def.defaultColSpan > def.maxColSpan) {
      throw new Error(
        `Section "${def.type}": defaultColSpan ${def.defaultColSpan} not in [${def.minColSpan}, ${def.maxColSpan}]`,
      );
    }
    this.entries.set(def.type, def as unknown as SectionDefinition);
  }

  /** Get a section definition by type slug, or null if not registered. */
  get(type: string): SectionDefinition | null {
    return this.entries.get(type) ?? null;
  }

  /** Whether a section type is registered. */
  has(type: string): boolean {
    return this.entries.has(type);
  }

  /** List all registered section definitions. */
  list(): SectionDefinition[] {
    return [...this.entries.values()];
  }

  /** Group registered sections by category, for palette rendering. */
  byCategory(): Record<SectionCategory, SectionDefinition[]> {
    const out: Record<SectionCategory, SectionDefinition[]> = {
      layout: [], content: [], data: [], interactive: [], editorial: [], embed: [], custom: [],
    };
    for (const def of this.entries.values()) {
      out[def.category].push(def);
    }
    return out;
  }

  /** Clear all registrations — test-only helper. */
  clear(): void {
    this.entries.clear();
  }

  /** Snapshot the registry for serialisation (e.g. /api/sections endpoint). */
  snapshot(): Array<Pick<
    SectionDefinition,
    'type' | 'name' | 'description' | 'icon' | 'category' | 'status'
    | 'minColSpan' | 'maxColSpan' | 'defaultColSpan' | 'resizable'
    | 'featureGate' | 'allowedZones' | 'previewImage' | 'schemaVersion'
  >> {
    return this.list().map((d) => ({
      type: d.type,
      name: d.name,
      description: d.description,
      icon: d.icon,
      category: d.category,
      status: d.status,
      minColSpan: d.minColSpan,
      maxColSpan: d.maxColSpan,
      defaultColSpan: d.defaultColSpan,
      resizable: d.resizable,
      featureGate: d.featureGate,
      allowedZones: d.allowedZones,
      previewImage: d.previewImage,
      schemaVersion: d.schemaVersion,
    }));
  }
}

/**
 * Resolve a section's `colSpan` for the current viewport, honouring the
 * fallback chain: `lg ↦ md ↦ sm ↦ base`. Mobile default is 12 (rows stack).
 */
export function resolveColSpan(
  baseColSpan: number,
  responsive: { sm?: number; md?: number; lg?: number } | undefined,
  viewport: 'sm' | 'md' | 'lg',
): number {
  if (viewport === 'lg') return responsive?.lg ?? baseColSpan;
  if (viewport === 'md') return responsive?.md ?? responsive?.lg ?? baseColSpan;
  // sm — mobile default is 12 unless explicitly overridden somewhere in the chain
  return responsive?.sm ?? 12;
}

/**
 * Apply per-type config migrations lazily on read. Walks the chain from
 * the section's stored `schemaVersion` to the registry's current version,
 * applying each step. Returns the migrated config + the new version.
 *
 * If a migration step is missing, returns the original config + a warning
 * (the caller — typically `<LayoutSlot>` — surfaces an admin-only placeholder).
 */
export function migrateSectionConfig<TConfig extends Record<string, unknown>>(
  def: SectionDefinition<TConfig>,
  storedConfig: Record<string, unknown>,
  storedVersion: number,
): { config: TConfig; version: number; warning?: string } {
  if (storedVersion >= def.schemaVersion) {
    // Downgrade is intentionally unsupported — return as-is + a note.
    return { config: storedConfig as TConfig, version: storedVersion };
  }
  let current = storedConfig;
  let version = storedVersion;
  while (version < def.schemaVersion) {
    const nextVersion = version + 1;
    const migrate = def.migrations?.[nextVersion];
    if (!migrate) {
      return {
        config: current as TConfig,
        version,
        warning: `Section "${def.type}" missing migration to version ${nextVersion}`,
      };
    }
    current = migrate(current);
    version = nextVersion;
  }
  return { config: current as TConfig, version };
}
