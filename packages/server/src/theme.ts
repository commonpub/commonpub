import { eq } from 'drizzle-orm';
import { users, instanceSettings } from '@commonpub/schema';
import type { DB } from './types.js';

const VALID_THEME_IDS = new Set(['base', 'dark', 'generics']);

function isValidThemeId(id: string): boolean {
  return VALID_THEME_IDS.has(id);
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
    if (user?.theme && isValidThemeId(user.theme)) {
      return user.theme;
    }
  }

  // 2. Instance default
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, 'theme.default'));
  if (setting?.value && typeof setting.value === 'string' && isValidThemeId(setting.value)) {
    return setting.value;
  }

  // 3. Fallback
  return 'base';
}

/** Get custom CSS token overrides configured at the instance level */
export async function getCustomTokenOverrides(db: DB): Promise<Record<string, string>> {
  const [setting] = await db
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, 'theme.token_overrides'));

  if (setting?.value && typeof setting.value === 'object' && setting.value !== null) {
    return setting.value as Record<string, string>;
  }

  return {};
}

/** Update a user's theme preference */
export async function setUserTheme(db: DB, userId: string, themeId: string): Promise<void> {
  if (!isValidThemeId(themeId)) {
    throw new Error(`Invalid theme ID: ${themeId}`);
  }

  await db
    .update(users)
    .set({ theme: themeId, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
