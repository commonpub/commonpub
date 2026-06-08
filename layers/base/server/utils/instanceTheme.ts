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
  /** Token map to inject as inline :root style (custom theme tokens + overrides). Empty when not needed. */
  injectedTokens: Record<string, string>;
  /** Google Fonts stylesheet URL for the active custom theme's fonts. Empty when none. */
  fontHref: string;
}> {
  const state = await getState();

  // Validate the admin's choice — fall back to base if missing/unknown
  const admin = isKnownThemeId(state.defaultTheme, state, registeredIds) ? state.defaultTheme : 'base';

  // Light/dark resolution. We only flip variants for built-in family pairs;
  // custom themes use their declared pair if present, otherwise stay put.
  let resolved = admin;
  if (userScheme !== null) {
    // Built-in family flip
    if (VALID_THEME_IDS.has(admin)) {
      const family = THEME_TO_FAMILY[admin] ?? 'classic';
      const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
      resolved = userScheme === 'dark' ? variants.dark : variants.light;
    } else {
      // Custom theme — use pairId if defined
      const custom = state.customByAttr.get(admin);
      if (custom?.pairId) {
        const pairAttr = `cpub-custom-${custom.pairId}`;
        const pair = state.customByAttr.get(pairAttr);
        if (pair && pair.isDark === (userScheme === 'dark')) {
          resolved = pairAttr;
        } else if (custom.isDark === (userScheme === 'dark')) {
          resolved = admin;
        }
      }
      // For registered themes (no pair info available server-side), we leave it alone
      // — the layer-app author can declare a pair via the future RegisteredTheme.pairId
    }
  }

  // isDark detection
  let isDark = false;
  if (VALID_THEME_IDS.has(resolved)) {
    isDark = IS_DARK[resolved] ?? false;
  } else {
    const custom = state.customByAttr.get(resolved);
    if (custom) isDark = custom.isDark;
  }

  // Tokens to inject inline. Built-in themes don't need injection (their
  // CSS files are already loaded). Custom themes always inject. Token
  // overrides apply on top of whatever theme is active.
  const injectedTokens: Record<string, string> = {};
  const activeCustom = state.customByAttr.get(resolved);
  if (activeCustom) {
    Object.assign(injectedTokens, activeCustom.tokens);
  }
  // Instance overrides always last so they win
  Object.assign(injectedTokens, state.tokenOverrides);

  // Google Fonts for the active custom theme (theme-studio sets `fonts`).
  const fontHref =
    activeCustom?.fonts && activeCustom.fonts.length > 0 ? googleHref(activeCustom.fonts) : '';

  return {
    resolvedTheme: resolved,
    instanceTheme: admin,
    isDark,
    injectedTokens,
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
