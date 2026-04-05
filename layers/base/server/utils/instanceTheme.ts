// Cached instance-level theme resolution for SSR.
// The admin sets a theme (determines family + default mode).
// Users only toggle light/dark within that family.

import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import { THEME_TO_FAMILY, FAMILY_VARIANTS, IS_DARK, VALID_THEME_IDS } from '../../utils/themeConfig';

const CACHE_TTL = 300_000; // 5 minutes — admin changes take up to 5 min to propagate

let cached: string | null = null;
let cacheTime = 0;

export async function getInstanceDefaultTheme(): Promise<string> {
  const now = Date.now();
  if (cached !== null && now - cacheTime < CACHE_TTL) return cached;

  try {
    const db = useDB();
    const [row] = await db
      .select({ value: instanceSettings.value })
      .from(instanceSettings)
      .where(eq(instanceSettings.key, 'theme.default'));

    if (row?.value && typeof row.value === 'string' && VALID_THEME_IDS.has(row.value)) {
      cached = row.value;
    } else {
      cached = 'base';
    }
  } catch (err) {
    console.warn('[theme] Failed to read instance theme from DB, using fallback:', err instanceof Error ? err.message : String(err));
    cached = 'base';
  }

  cacheTime = now;
  return cached;
}

/**
 * Resolve the final theme ID given the admin's chosen default and the
 * user's light/dark preference.
 */
export function resolveThemeForUser(
  adminTheme: string,
  userScheme: 'light' | 'dark' | null,
): string {
  const family = THEME_TO_FAMILY[adminTheme] ?? 'classic';
  const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;

  if (userScheme === null) return adminTheme;
  return userScheme === 'dark' ? variants.dark : variants.light;
}

/** Whether a given theme ID is dark */
export function isDefaultDark(themeId: string): boolean {
  return IS_DARK[themeId] ?? false;
}

/** Call after admin changes the instance default theme */
export function invalidateThemeCache(): void {
  cached = null;
  cacheTime = 0;
}

export function isServerValidThemeId(id: string): boolean {
  return VALID_THEME_IDS.has(id);
}
