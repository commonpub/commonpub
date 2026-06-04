/**
 * Shared client-side state for the admin theme system.
 *
 * Singleton — both the list page (`/admin/theme`) and the editor
 * (`/admin/theme/edit/[id]`) read the same `data`/`families` refs so
 * a save in one place propagates to the other without refetching.
 *
 * Discovery helpers live in `utils/themeDiscovery.ts`; import/export
 * in `utils/themeIO.ts`; id helpers in `utils/themeIds.ts`; types in
 * `types/theme.ts`. This file orchestrates them into one composable.
 */
import { computed, ref } from 'vue';
import { BUILT_IN_THEMES, previewFromTokens } from '@commonpub/ui';
import type { CustomThemeRecord, ThemesPayload, ThemeFamilyView } from '../types/theme';

// ---- Family display metadata for built-in themes ------------------------

const BUILT_IN_FAMILY_META: Record<string, { name: string; description: string }> = {
  classic: { name: 'Classic', description: 'Sharp corners, offset shadows, blue accent, the original CommonPub look' },
  agora: { name: 'Agora', description: 'Warm parchment tones, green accent, serif display font, institutional warmth' },
  generics: { name: 'Generics', description: 'Minimal dark aesthetic with soft glow shadows' },
};

const BUILT_IN_PREVIEWS: Record<string, { bg: string; surface: string; accent: string; text: string; border: string }> = {
  base: { bg: '#fafaf9', surface: '#ffffff', accent: '#5b9cf6', text: '#1a1a1a', border: '#1a1a1a' },
  dark: { bg: '#111111', surface: '#1a1a1a', accent: '#5b9cf6', text: '#e5e5e3', border: '#444440' },
  generics: { bg: '#0c0c0b', surface: '#141413', accent: '#5b9cf6', text: '#d8d5cf', border: '#272725' },
  agora: { bg: '#f7f4ed', surface: '#faf8f3', accent: '#3d8b5e', text: '#1a1a1a', border: '#1a1a1a' },
  'agora-dark': { bg: '#0d1a12', surface: '#141f17', accent: '#4aa06e', text: '#e8e8e2', border: '#3a4f40' },
};

// ---- Singleton state ----------------------------------------------------

const data = ref<ThemesPayload | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function refresh(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await $fetch<ThemesPayload>('/api/admin/themes');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load themes';
  } finally {
    loading.value = false;
  }
}

// ---- Family view-model builder ------------------------------------------

/**
 * Merge built-in + registered + custom themes into one family-grouped
 * list. The same family slug across sources collapses into a single
 * entry; later sources overwrite earlier display metadata (custom >
 * registered > built-in).
 */
function buildFamilies(payload: ThemesPayload): ThemeFamilyView[] {
  const map = new Map<string, ThemeFamilyView>();

  // Built-in first
  for (const t of payload.builtIn) {
    const meta = BUILT_IN_FAMILY_META[t.family] ?? { name: t.family, description: '' };
    const fam = ensureFamily(map, t.family, {
      name: meta.name,
      description: meta.description,
      source: 'builtin',
    });
    const preview = BUILT_IN_PREVIEWS[t.id] ?? (t.isDark ? BUILT_IN_PREVIEWS.dark! : BUILT_IN_PREVIEWS.base!);
    placeVariant(fam, t.id, t.name, t.isDark, preview);
  }

  // Registered themes — promote source if family was previously built-in
  for (const t of payload.registered) {
    const fallback = t.isDark ? BUILT_IN_PREVIEWS.dark! : BUILT_IN_PREVIEWS.base!;
    const preview = {
      bg: t.preview?.bg ?? fallback.bg,
      surface: t.preview?.surface ?? fallback.surface,
      accent: t.preview?.accent ?? fallback.accent,
      text: t.preview?.text ?? fallback.text,
      border: t.preview?.border ?? fallback.border,
    };
    const fam = ensureFamily(map, t.family, {
      name: t.name,
      description: t.description ?? `Code-registered theme from this app's commonpub.config.ts`,
      source: 'registered',
    });
    if (fam.source === 'builtin') fam.source = 'registered';
    placeVariant(fam, t.id, t.name, t.isDark, preview);
  }

  // Custom (DB-stored) — these win the meta tug-of-war
  for (const t of payload.custom) {
    const dataAttr = `cpub-custom-${t.id}`;
    const preview = previewFromTokens(t.tokens, t.isDark);
    const fam = ensureFamily(map, t.family, {
      name: t.name,
      description: t.description || 'Custom theme',
      source: 'custom',
    });
    fam.source = 'custom';
    fam.name = t.name;
    if (t.description) fam.description = t.description;
    placeVariant(fam, dataAttr, t.name, t.isDark, preview);
  }

  return [...map.values()];
}

function ensureFamily(
  map: Map<string, ThemeFamilyView>,
  id: string,
  init: { name: string; description: string; source: ThemeFamilyView['source'] },
): ThemeFamilyView {
  let fam = map.get(id);
  if (!fam) {
    fam = {
      id,
      name: init.name,
      description: init.description,
      source: init.source,
      light: null,
      dark: null,
      preview: { light: BUILT_IN_PREVIEWS.base!, dark: BUILT_IN_PREVIEWS.dark! },
    };
    map.set(id, fam);
  }
  return fam;
}

function placeVariant(
  fam: ThemeFamilyView,
  themeId: string,
  themeName: string,
  isDark: boolean,
  preview: { bg: string; surface: string; accent: string; text: string; border: string },
): void {
  if (isDark) {
    fam.dark = { id: themeId, name: themeName };
    fam.preview.dark = preview;
  } else {
    fam.light = { id: themeId, name: themeName };
    fam.preview.light = preview;
  }
}

// ---- Composable surface -------------------------------------------------

export function useThemeAdmin(): {
  data: typeof data;
  loading: typeof loading;
  error: typeof error;
  families: import('vue').ComputedRef<ThemeFamilyView[]>;
  refresh: typeof refresh;
  /** Find a custom theme by id in the current payload. Returns null if absent. */
  findCustom: (id: string) => CustomThemeRecord | null;
} {
  const families = computed<ThemeFamilyView[]>(() => (data.value ? buildFamilies(data.value) : []));
  return {
    data,
    loading,
    error,
    families,
    refresh,
    findCustom: (id: string) => data.value?.custom.find((t) => t.id === id) ?? null,
  };
}
