// Cached instance-level theme resolution for SSR.
// The admin sets a theme (determines family + default mode).
// Users only toggle light/dark within that family.

import { eq } from 'drizzle-orm';
import { instanceSettings, isSafeBgImageValue } from '@commonpub/schema';
import {
  getCustomTokenOverrides,
  listCustomThemes,
  parseCustomThemeId,
  type CustomThemeRecord,
} from '@commonpub/server';
import { googleHref } from '@commonpub/theme-studio';
import { THEME_TO_FAMILY, FAMILY_VARIANTS, IS_DARK, VALID_THEME_IDS } from '../../utils/themeConfig';

const CACHE_TTL = 60_000; // 1 minute, admin changes propagate fast

/**
 * Sink-side guard for the one token whose VALUE can fetch when rendered:
 * `--bg-image` feeds `background-image`, so a `url(...)` is a beacon/exfil
 * channel. The themes POST/PUT already reject unsafe values, but the token
 * map has other write paths (the generic admin settings route writes
 * `instance_settings` keys wholesale), so the render sink enforces the same
 * allowlist: a non-gradient bg-image is dropped, never injected.
 */
export function sanitizeRenderTokens(tokens: Record<string, string>): Record<string, string> {
  const v = tokens['bg-image'];
  if (v === undefined || isSafeBgImageValue(v)) return tokens;
  const { 'bg-image': _dropped, ...rest } = tokens;
  return rest;
}

interface CachedThemeState {
  /** The admin's chosen default theme (built-in id, custom data-attr, or registered id) */
  /** Admin-picked default theme id, or null when never set in the DB. */
  defaultTheme: string | null;
  /** All DB-stored custom themes, keyed by their data-theme attribute (`cpub-custom-<slug>`) */
  customByAttr: Map<string, CustomThemeRecord>;
  /** Instance-wide token overrides applied on top of the active theme */
  tokenOverrides: Record<string, string>;
}

let cached: CachedThemeState | null = null;
let cacheTime = 0;

async function loadThemeState(): Promise<CachedThemeState> {
  const db = useDB();

  // 1. Default theme ID from the DB. `null` when the admin never picked one —
  // resolveThemeContext then falls back to the thin app's `config.defaultTheme`
  // (a branded instance pins its identity in code) and finally to 'stoa' (the
  // CommonPub default for fresh installs). Tracking absence here, instead of
  // baking 'stoa' in, is what lets a config-pinned brand theme take effect —
  // deveco rode the stoa fallback for months, which made its dark mode and
  // theme identity wrong.
  let defaultTheme: string | null = null;
  try {
    const [row] = await db
      .select({ value: instanceSettings.value })
      .from(instanceSettings)
      .where(eq(instanceSettings.key, 'theme.default'));
    if (row?.value && typeof row.value === 'string' && row.value.length > 0) {
      defaultTheme = row.value;
    }
  } catch (err) {
    console.warn('[theme] Failed to read instance theme:', err instanceof Error ? err.message : String(err));
  }

  // 2. DB-stored custom themes
  let customByAttr = new Map<string, CustomThemeRecord>();
  try {
    const customs = await listCustomThemes(db);
    customByAttr = new Map(customs.map((t) => [`cpub-custom-${t.id}`, t]));
  } catch (err) {
    console.warn('[theme] Failed to load custom themes:', err instanceof Error ? err.message : String(err));
  }

  // 3. Instance-wide token overrides
  let tokenOverrides: Record<string, string> = {};
  try {
    tokenOverrides = await getCustomTokenOverrides(db);
  } catch (err) {
    console.warn('[theme] Failed to load token overrides:', err instanceof Error ? err.message : String(err));
  }

  return { defaultTheme, customByAttr, tokenOverrides };
}

async function getState(): Promise<CachedThemeState> {
  const now = Date.now();
  if (cached !== null && now - cacheTime < CACHE_TTL) return cached;
  cached = await loadThemeState();
  cacheTime = now;
  return cached;
}

/** The registry metadata the theme resolver needs (subset of RegisteredTheme). */
export interface RegisteredThemeMeta {
  id: string;
  family?: string;
  isDark?: boolean;
  pairId?: string;
}

/** Validate a theme ID against built-in, custom, and registered themes. */
function isKnownThemeId(id: string, state: CachedThemeState, registeredIds: Set<string>): boolean {
  if (VALID_THEME_IDS.has(id)) return true;
  if (state.customByAttr.has(id)) return true;
  if (registeredIds.has(id)) return true;
  return false;
}

/** A registered theme's dark-ness: explicit flag, else inferred from the
 *  `-dark` id suffix — naming a theme `foo-dark` should just work. */
function registeredIsDark(meta: RegisteredThemeMeta): boolean {
  return meta.isDark ?? /(^|-)dark$/.test(meta.id);
}

/**
 * Pick a registered theme's variant for the user's light/dark preference.
 * Pure (exported for tests). Sibling resolution order:
 *   1. explicit `pairId`
 *   2. same `family`, opposite dark-ness
 *   3. NAME CONVENTION: `<id>` ↔ `<id>-dark` — registering two themes named
 *      like a pair auto-detects with no family/pairId declared at all.
 * Falls back to the theme itself when no opposite-mode sibling exists.
 */
export function resolveRegisteredVariant(
  themeId: string,
  userScheme: 'light' | 'dark' | null,
  registered: RegisteredThemeMeta[],
): { resolved: string; isDark: boolean; pair: { lightAttr: string; darkAttr: string } | null } {
  const meta = registered.find((t) => t.id === themeId);
  if (!meta) return { resolved: themeId, isDark: false, pair: null };
  const metaDark = registeredIsDark(meta);

  const conventionId = metaDark ? meta.id.replace(/-dark$/, '') : `${meta.id}-dark`;
  const sibling =
    (meta.pairId ? registered.find((t) => t.id === meta.pairId) : undefined) ??
    (meta.family
      ? registered.find((t) => t.id !== meta.id && t.family === meta.family && registeredIsDark(t) !== metaDark)
      : undefined) ??
    (conventionId !== meta.id
      ? registered.find((t) => t.id === conventionId && registeredIsDark(t) !== metaDark)
      : undefined);

  const light = metaDark ? sibling : meta;
  const dark = metaDark ? meta : sibling;
  const pair = light && dark ? { lightAttr: light.id, darkAttr: dark.id } : null;

  let resolvedMeta = meta;
  if (userScheme === 'dark' && dark) resolvedMeta = dark;
  else if (userScheme === 'light' && light) resolvedMeta = light;

  return { resolved: resolvedMeta.id, isDark: registeredIsDark(resolvedMeta), pair };
}

export async function getInstanceDefaultTheme(): Promise<string> {
  const state = await getState();
  return state.defaultTheme ?? 'stoa';
}

/**
 * Resolve everything SSR needs for the active theme on this request:
 * the data-theme attribute value, the inherited family/mode, and any
 * inline tokens (custom theme + instance overrides) to inject.
 */
export async function resolveThemeContext(
  userScheme: 'light' | 'dark' | null,
  registered: RegisteredThemeMeta[],
  configDefaultTheme?: string,
): Promise<{
  /** Final data-theme value for <html> */
  resolvedTheme: string;
  /** Admin's chosen default (before light/dark override) */
  instanceTheme: string;
  /** Whether the resolved theme is dark */
  isDark: boolean;
  /**
   * Custom-theme token blocks to inject, one per variant, each scoped to its
   * own `[data-theme]` selector. For a light/dark PAIR this is BOTH variants,
   * so the client can flip `data-theme` and switch instantly (no round-trip).
   * Empty for built-in / registered themes (their CSS files handle modes).
   */
  themeVariants: Array<{ attr: string; tokens: Record<string, string> }>;
  /** Instance-wide token overrides (apply in every mode). */
  overrides: Record<string, string>;
  /** Light/dark attrs of a custom pair, so the client toggle can flip instantly. */
  pair: { lightAttr: string; darkAttr: string } | null;
  /** Google Fonts stylesheet URL for the active custom theme(s) fonts. Empty when none. */
  fontHref: string;
}> {
  const state = await getState();
  const registeredIds = new Set(registered.map((t) => t.id));

  // Default resolution chain: explicit DB setting → the thin app's
  // config.defaultTheme (brand identity pinned in code) → 'stoa' (CommonPub
  // default). Each candidate must be a KNOWN id; an unknown choice falls
  // through rather than rendering an unstyled attr.
  const candidates = [state.defaultTheme, configDefaultTheme, 'stoa'];
  const admin = candidates.find(
    (c): c is string => !!c && isKnownThemeId(c, state, registeredIds),
  ) ?? 'base';

  const activeCustom = state.customByAttr.get(admin);
  let resolved = admin;
  let isDark = false;
  let themeVariants: Array<{ attr: string; tokens: Record<string, string> }> = [];
  let pair: { lightAttr: string; darkAttr: string } | null = null;
  let fontHref = '';

  if (activeCustom) {
    // Gather the pair members (the default + its sibling, if both exist).
    const members: Array<{ attr: string; rec: CustomThemeRecord }> = [{ attr: admin, rec: activeCustom }];
    if (activeCustom.pairId) {
      const sibAttr = `cpub-custom-${activeCustom.pairId}`;
      const sib = state.customByAttr.get(sibAttr);
      if (sib) members.push({ attr: sibAttr, rec: sib });
    }
    themeVariants = members.map((m) => ({ attr: m.attr, tokens: sanitizeRenderTokens(m.rec.tokens) }));
    const lightM = members.find((m) => !m.rec.isDark);
    const darkM = members.find((m) => m.rec.isDark);
    if (members.length === 2 && lightM && darkM) {
      pair = { lightAttr: lightM.attr, darkAttr: darkM.attr };
    }
    // <html data-theme> = the variant matching the user's scheme (else the default).
    if (userScheme === 'dark' && darkM) resolved = darkM.attr;
    else if (userScheme === 'light' && lightM) resolved = lightM.attr;
    else resolved = admin;
    isDark = state.customByAttr.get(resolved)?.isDark ?? activeCustom.isDark;
    // Load every variant's fonts so a client-side flip already has them.
    const allFonts = [...new Set(members.flatMap((m) => m.rec.fonts ?? []))];
    fontHref = allFonts.length ? googleHref(allFonts) : '';
  } else if (VALID_THEME_IDS.has(admin)) {
    // Built-in: flip via the family's CSS variants.
    if (userScheme !== null) {
      const family = THEME_TO_FAMILY[admin] ?? 'classic';
      const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
      resolved = userScheme === 'dark' ? variants.dark : variants.light;
    }
    isDark = IS_DARK[resolved] ?? false;
  } else {
    // Code-registered theme: flip within ITS registered family (pairId or
    // family+isDark), and expose the pair so the client toggle can switch
    // instantly — previously registered themes had NO light/dark support and
    // the toggle silently did nothing (or fell back to the layer family).
    const r = resolveRegisteredVariant(admin, userScheme, registered);
    resolved = r.resolved;
    isDark = r.isDark;
    pair = r.pair;
  }

  return {
    resolvedTheme: resolved,
    instanceTheme: admin,
    isDark,
    themeVariants,
    overrides: sanitizeRenderTokens({ ...state.tokenOverrides }),
    pair,
    fontHref,
  };
}

/** Whether a given theme ID is dark (built-in only; legacy callers). */
export function isDefaultDark(themeId: string): boolean {
  return IS_DARK[themeId] ?? false;
}

/** Call after admin changes the instance default theme or saves a custom theme */
export function invalidateThemeCache(): void {
  cached = null;
  cacheTime = 0;
}

export function isServerValidThemeId(id: string): boolean {
  return VALID_THEME_IDS.has(id) || parseCustomThemeId(id) !== null;
}

/** Legacy export, used by /api/profile/theme.put.ts and similar. */
export function resolveThemeForUser(
  adminTheme: string,
  userScheme: 'light' | 'dark' | null,
): string {
  const family = THEME_TO_FAMILY[adminTheme] ?? 'classic';
  const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
  if (userScheme === null) return adminTheme;
  return userScheme === 'dark' ? variants.dark : variants.light;
}
