import { eq } from 'drizzle-orm';
import { users, instanceSettings } from '@commonpub/schema';
import type { DB } from './types.js';

const BUILT_IN_THEME_IDS = new Set(['base', 'dark', 'generics', 'agora', 'agora-dark']);

/** Custom-theme ID prefix used in `data-theme` attribute + DB lookup. */
export const CUSTOM_THEME_PREFIX = 'cpub-custom-';

/** Storage key in `instance_settings` holding the custom-themes array. */
const CUSTOM_THEMES_KEY = 'theme.custom';

/**
 * A custom theme record persisted in `instance_settings.theme.custom`.
 * Mirrors `customThemeSchema` in @commonpub/schema validators.
 */
export interface CustomThemeRecord {
  id: string;
  name: string;
  description?: string;
  family: string;
  isDark: boolean;
  pairId?: string;
  parentTheme: string;
  tokens: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Slug used in `data-theme` for a DB-stored custom theme. */
export function customThemeDataAttr(id: string): string {
  return `${CUSTOM_THEME_PREFIX}${id}`;
}

/** Reverse of customThemeDataAttr — returns the raw custom theme ID or null. */
export function parseCustomThemeId(themeId: string): string | null {
  if (themeId.startsWith(CUSTOM_THEME_PREFIX)) {
    return themeId.slice(CUSTOM_THEME_PREFIX.length);
  }
  return null;
}

function isBuiltInThemeId(id: string): boolean {
  return BUILT_IN_THEME_IDS.has(id);
}

/**
 * Whether a theme ID is structurally valid (sanity check only — defends
 * against path traversal / injection in the data attribute). Accepts:
 *   - built-in IDs
 *   - DB custom IDs (`cpub-custom-*`)
 *   - any slug-shaped string (covers code-registered themes from the
 *     thin layer app's `commonpub.config.ts`)
 *
 * Cross-checking against the actual list of available themes happens at
 * the route-handler layer (`api/admin/themes/*` and the SSR middleware,
 * which both see the runtime config). On read, unknown values fall back
 * to `base` silently rather than throwing — the user shouldn't see a
 * broken theme just because an admin deleted a custom one.
 */
function isAcceptableThemeId(id: string): boolean {
  if (isBuiltInThemeId(id)) return true;
  if (parseCustomThemeId(id) !== null) return true;
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id);
}

/**
 * Resolve the active theme for a request.
 * Priority: user preference > instance default > 'base' fallback.
 * Framework-agnostic — cookie checking should be done by the caller.
 */
export async function resolveTheme(db: DB, userId?: string): Promise<string> {
  // 1. User preference
  if (userId) {
    const [user] = await db
      .select({ theme: users.theme })
      .from(users)
      .where(eq(users.id, userId));
    if (user?.theme && isAcceptableThemeId(user.theme)) {
      return user.theme;
    }
  }

  // 2. Instance default
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, 'theme.default'));
  if (setting?.value && typeof setting.value === 'string' && isAcceptableThemeId(setting.value)) {
    return setting.value;
  }

  // 3. Fallback
  return 'base';
}

/** Get custom CSS token overrides configured at the instance level. These
 *  apply on top of whatever theme is active (built-in, custom, or code). */
export async function getCustomTokenOverrides(db: DB): Promise<Record<string, string>> {
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, 'theme.token_overrides'));

  if (setting?.value && typeof setting.value === 'object' && setting.value !== null && !Array.isArray(setting.value)) {
    // Filter only string values so malformed rows can't break SSR
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(setting.value as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }

  return {};
}

/** Update a user's theme preference */
export async function setUserTheme(db: DB, userId: string, themeId: string): Promise<void> {
  if (!isAcceptableThemeId(themeId)) {
    throw new Error(`Invalid theme ID: ${themeId}`);
  }

  await db
    .update(users)
    .set({ theme: themeId, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// --- Custom (DB-stored) themes -------------------------------------------

/** List all DB-stored custom themes. Returns an empty array if none exist. */
export async function listCustomThemes(db: DB): Promise<CustomThemeRecord[]> {
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, CUSTOM_THEMES_KEY));

  if (!setting?.value || !Array.isArray(setting.value)) return [];

  // Defensive: filter to records that have the required shape so a partial
  // write (or future schema change) can't crash SSR.
  return (setting.value as unknown[]).filter((row): row is CustomThemeRecord => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.family === 'string' &&
      typeof r.isDark === 'boolean' &&
      typeof r.tokens === 'object' &&
      r.tokens !== null
    );
  });
}

/** Fetch a single custom theme by ID. */
export async function getCustomTheme(db: DB, id: string): Promise<CustomThemeRecord | null> {
  const all = await listCustomThemes(db);
  return all.find((t) => t.id === id) ?? null;
}

/**
 * Upsert a custom theme. The whole `theme.custom` array is rewritten on each
 * save — fine because the array is small (admins manage a handful of themes)
 * and gives us atomic consistency without a separate table.
 */
export async function saveCustomTheme(
  db: DB,
  theme: Omit<CustomThemeRecord, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
  adminId: string,
): Promise<CustomThemeRecord> {
  const all = await listCustomThemes(db);
  const now = new Date().toISOString();
  const existing = all.find((t) => t.id === theme.id);
  const next: CustomThemeRecord = {
    id: theme.id,
    name: theme.name,
    description: theme.description ?? '',
    family: theme.family,
    isDark: theme.isDark,
    pairId: theme.pairId,
    parentTheme: theme.parentTheme,
    tokens: theme.tokens,
    createdAt: existing?.createdAt ?? theme.createdAt ?? now,
    updatedAt: now,
  };

  const newList = existing
    ? all.map((t) => (t.id === theme.id ? next : t))
    : [...all, next];

  await writeCustomThemes(db, newList, adminId);
  return next;
}

/** Delete a custom theme. No-op if not found. */
export async function deleteCustomTheme(db: DB, id: string, adminId: string): Promise<void> {
  const all = await listCustomThemes(db);
  if (!all.some((t) => t.id === id)) return;
  const next = all.filter((t) => t.id !== id);
  await writeCustomThemes(db, next, adminId);
}

async function writeCustomThemes(
  db: DB,
  next: CustomThemeRecord[],
  adminId: string,
): Promise<void> {
  const existing = await db
    .select({ id: instanceSettings.id })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, CUSTOM_THEMES_KEY));

  if (existing.length > 0) {
    await db
      .update(instanceSettings)
      .set({ value: next, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(instanceSettings.key, CUSTOM_THEMES_KEY));
  } else {
    await db.insert(instanceSettings).values({
      key: CUSTOM_THEMES_KEY,
      value: next,
      updatedBy: adminId,
      updatedAt: new Date(),
    });
  }
}
