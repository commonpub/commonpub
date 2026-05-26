/**
 * Custom theme CRUD — integration tests against a real Postgres instance.
 * Mirrors the patterns in `theme-oauth.integration.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  listCustomThemes,
  getCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  customThemeDataAttr,
  parseCustomThemeId,
  resolveTheme,
  setUserTheme,
} from '../theme.js';

describe('custom theme CRUD', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { role: 'admin' });
    adminId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('starts with no custom themes', async () => {
    const themes = await listCustomThemes(db);
    expect(themes).toEqual([]);
  });

  it('saves and retrieves a custom theme', async () => {
    const saved = await saveCustomTheme(
      db,
      {
        id: 'deveco',
        name: 'devEco',
        description: 'Edge AI brand',
        family: 'deveco',
        isDark: false,
        parentTheme: 'base',
        tokens: { accent: '#00e7ad', bg: '#f9fafb' },
      },
      adminId,
    );
    expect(saved.id).toBe('deveco');
    expect(saved.tokens.accent).toBe('#00e7ad');
    expect(saved.createdAt).toBeTruthy();
    expect(saved.updatedAt).toBeTruthy();

    const fetched = await getCustomTheme(db, 'deveco');
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('devEco');
  });

  it('updates an existing theme without changing createdAt', async () => {
    const initial = await getCustomTheme(db, 'deveco');
    expect(initial).not.toBeNull();
    const createdAt = initial!.createdAt;

    // Tiny delay so updatedAt definitely advances
    await new Promise((r) => setTimeout(r, 10));

    const updated = await saveCustomTheme(
      db,
      {
        id: 'deveco',
        name: 'devEco v2',
        description: 'Edge AI brand',
        family: 'deveco',
        isDark: false,
        parentTheme: 'base',
        tokens: { accent: '#00d49f' },
      },
      adminId,
    );
    expect(updated.name).toBe('devEco v2');
    expect(updated.tokens.accent).toBe('#00d49f');
    expect(updated.createdAt).toBe(createdAt);
    expect(updated.updatedAt).not.toBe(initial!.updatedAt);
  });

  it('lists multiple themes', async () => {
    await saveCustomTheme(
      db,
      {
        id: 'deveco-dark',
        name: 'devEco Dark',
        description: '',
        family: 'deveco',
        isDark: true,
        pairId: 'deveco',
        parentTheme: 'dark',
        tokens: { accent: '#00e7ad', bg: '#0d1117' },
      },
      adminId,
    );
    const all = await listCustomThemes(db);
    expect(all.map((t) => t.id).sort()).toEqual(['deveco', 'deveco-dark']);
  });

  it('deletes a theme', async () => {
    await deleteCustomTheme(db, 'deveco-dark', adminId);
    const all = await listCustomThemes(db);
    expect(all.map((t) => t.id)).toEqual(['deveco']);
  });

  it('is a no-op when deleting a non-existent id', async () => {
    await expect(deleteCustomTheme(db, 'nope', adminId)).resolves.toBeUndefined();
  });
});

describe('customThemeDataAttr / parseCustomThemeId', () => {
  it('round-trips slug ↔ data-theme attribute', () => {
    expect(customThemeDataAttr('deveco')).toBe('cpub-custom-deveco');
    expect(parseCustomThemeId('cpub-custom-deveco')).toBe('deveco');
  });
  it('returns null for non-custom ids', () => {
    expect(parseCustomThemeId('base')).toBeNull();
    expect(parseCustomThemeId('agora-dark')).toBeNull();
  });
});

describe('resolveTheme accepts custom theme ids', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db);
    userId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('accepts a cpub-custom-* id as a user preference', async () => {
    await setUserTheme(db, userId, 'cpub-custom-deveco');
    const t = await resolveTheme(db, userId);
    expect(t).toBe('cpub-custom-deveco');
  });

  it('rejects garbage ids on setUserTheme', async () => {
    await expect(setUserTheme(db, userId, '../../../etc/passwd')).rejects.toThrow();
  });
});
