// Cached instance-level theme resolution for SSR.
// The admin sets a theme (determines family + default mode).
// Users only toggle light/dark within that family.

import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import {
  getCustomTokenOverrides,
  listCustomThemes,
  parseCustomThemeId,
  type CustomThemeRecord,
} from '@commonpub/server';
import { googleHref } from '@commonpub/theme-studio';
import { THEME_TO_FAMILY, FAMILY_VARIANTS, IS_DARK, VALID_THEME_IDS } from '../../utils/themeConfig';

const CACHE_TTL = 60_000; // 1 minute, admin changes propagate fast

interface CachedThemeState {
  /** The admin's chosen default theme (built-in id, custom data-attr, or registered id) */
  defaultTheme: string;
  /** All DB-stored custom themes, keyed by their data-theme attribute (`cpub-custom-<slug>`) */
  customByAttr: Map<string, CustomThemeRecord>;
  /** Instance-wide token overrides applied on top of the active theme */
  tokenOverrides: Record<string, string>;
}

let cached: CachedThemeState | null = null;
let cacheTime = 0;

async function loadThemeState(): Promise<CachedThemeState> {
  const db = useDB();

  // 1. Default theme ID.
  // Fallback is 'stoa' — the default CommonPub theme for fresh installs and any
  // instance that has NOT explicitly set `theme.default` in the DB. Instances
  // with an explicit setting (e.g. commonpub.io=agora-dark, branded instances)
  // are unaffected; this only changes what an unconfigured instance shows.
  let defaultTheme = 'stoa';
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

/** Validate a theme ID against built-in, custom, and registered themes. */
function isKnownThemeId(id: string, state: CachedThemeState, registeredIds: Set<string>): boolean {
  if (VALID_THEME_IDS.has(id)) return true;
  if (state.customByAttr.has(id)) return true;
  if (registeredIds.has(id)) return true;
  return false;
}

export async function getInstanceDefaultTheme(): Promise<string> {
  const state = await getState();
  return state.defaultTheme;
}

/**
 * Resolve everything SSR needs for the active theme on this request:
 * the data-theme attribute value, the inherited family/mode, and any
 * inline tokens (custom theme + instance overrides) to inject.
 */
export async function resolveThemeContext(
  userScheme: 'light' | 'dark' | null,
  registeredIds: Set<string>,
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

  // Validate the admin's choice — fall back to base if missing/unknown
  const admin = isKnownThemeId(state.defaultTheme, state, registeredIds) ? state.defaultTheme : 'base';

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
    themeVariants = members.map((m) => ({ attr: m.attr, tokens: m.rec.tokens }));
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
  } else {
    // Built-in / registered: flip via the family's CSS variants on round-trip.
    if (userScheme !== null && VALID_THEME_IDS.has(admin)) {
      const family = THEME_TO_FAMILY[admin] ?? 'classic';
      const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
      resolved = userScheme === 'dark' ? variants.dark : variants.light;
    }
    isDark = IS_DARK[resolved] ?? false;
  }

  return {
    resolvedTheme: resolved,
    instanceTheme: admin,
    isDark,
    themeVariants,
    overrides: { ...state.tokenOverrides },
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
