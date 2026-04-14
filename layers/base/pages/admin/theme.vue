<script setup lang="ts">
import { BUILT_IN_THEMES } from '@commonpub/ui';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Theme — Admin — ${useSiteName()}` });

const { data: settings, pending, refresh } = await useFetch<Record<string, unknown>>('/api/admin/settings');

const saving = ref(false);
const saveSuccess = ref(false);

const instanceDefault = computed(() => {
  const val = settings.value?.['theme.default'];
  return typeof val === 'string' ? val : 'base';
});

// Build families from BUILT_IN_THEMES
interface ThemeFamily {
  id: string;
  name: string;
  description: string;
  light: { id: string; name: string } | null;
  dark: { id: string; name: string } | null;
  preview: {
    light: { bg: string; surface: string; accent: string; text: string; border: string };
    dark: { bg: string; surface: string; accent: string; text: string; border: string };
  };
}

const PREVIEW_COLORS: Record<string, { bg: string; surface: string; accent: string; text: string; border: string }> = {
  base: { bg: '#fafaf9', surface: '#ffffff', accent: '#5b9cf6', text: '#1a1a1a', border: '#1a1a1a' },
  dark: { bg: '#111111', surface: '#1a1a1a', accent: '#5b9cf6', text: '#e5e5e3', border: '#444440' },
  generics: { bg: '#0c0c0b', surface: '#141413', accent: '#5b9cf6', text: '#d8d5cf', border: '#272725' },
  agora: { bg: '#f7f4ed', surface: '#faf8f3', accent: '#3d8b5e', text: '#1a1a1a', border: '#1a1a1a' },
  'agora-dark': { bg: '#0d1a12', surface: '#141f17', accent: '#4aa06e', text: '#e8e8e2', border: '#3a4f40' },
};

const FAMILY_META: Record<string, { name: string; description: string }> = {
  classic: { name: 'Classic', description: 'Sharp corners, offset shadows, blue accent — the original CommonPub look' },
  agora: { name: 'Agora', description: 'Warm parchment tones, green accent, Fraunces serif — institutional warmth' },
  generics: { name: 'Generics', description: 'Minimal dark aesthetic with soft glow shadows' },
};

const families = computed<ThemeFamily[]>(() => {
  const map = new Map<string, ThemeFamily>();

  for (const theme of BUILT_IN_THEMES) {
    if (!map.has(theme.family)) {
      const meta = FAMILY_META[theme.family] ?? { name: theme.family, description: '' };
      map.set(theme.family, {
        id: theme.family,
        name: meta.name,
        description: meta.description,
        light: null,
        dark: null,
        preview: {
          light: PREVIEW_COLORS.base!,
          dark: PREVIEW_COLORS.dark!,
        },
      });
    }
    const fam = map.get(theme.family)!;
    if (theme.isDark) {
      fam.dark = { id: theme.id, name: theme.name };
      fam.preview.dark = PREVIEW_COLORS[theme.id] ?? PREVIEW_COLORS.dark!;
    } else {
      fam.light = { id: theme.id, name: theme.name };
      fam.preview.light = PREVIEW_COLORS[theme.id] ?? PREVIEW_COLORS.base!;
    }
  }

  return [...map.values()];
});

/** Which family is currently active? */
const THEME_TO_FAMILY: Record<string, string> = {
  base: 'classic', dark: 'classic', generics: 'generics',
  agora: 'agora', 'agora-dark': 'agora',
};
const activeFamily = computed(() => THEME_TO_FAMILY[instanceDefault.value] ?? 'classic');

async function selectFamily(family: ThemeFamily): Promise<void> {
  // Set the light variant as default (users toggle dark mode themselves)
  const themeId = family.light?.id ?? family.dark?.id ?? 'base';
  saving.value = true;
  saveSuccess.value = false;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { key: 'theme.default', value: themeId },
    });
    await refresh();
    saveSuccess.value = true;
    setTimeout(() => { saveSuccess.value = false; }, 2000);
  } finally {
    saving.value = false;
  }
}

// Token overrides
const tokenOverrides = ref<Record<string, string>>({});
const newTokenKey = ref('');
const newTokenValue = ref('');

watchEffect(() => {
  const raw = settings.value?.['theme.token_overrides'];
  if (raw && typeof raw === 'object' && raw !== null) {
    tokenOverrides.value = { ...(raw as Record<string, string>) };
  } else {
    tokenOverrides.value = {};
  }
});

async function saveTokenOverrides(): Promise<void> {
  saving.value = true;
  saveSuccess.value = false;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { key: 'theme.token_overrides', value: tokenOverrides.value },
    });
    await refresh();
    saveSuccess.value = true;
    setTimeout(() => { saveSuccess.value = false; }, 2000);
  } finally {
    saving.value = false;
  }
}

function addTokenOverride(): void {
  const key = newTokenKey.value.trim();
  const value = newTokenValue.value.trim();
  if (!key || !value) return;
  tokenOverrides.value[key] = value;
  newTokenKey.value = '';
  newTokenValue.value = '';
}

function removeTokenOverride(key: string): void {
  const next = { ...tokenOverrides.value };
  delete next[key];
  tokenOverrides.value = next;
}
</script>

<template>
  <div class="admin-theme">
    <div class="admin-theme-header">
      <h1 class="admin-page-title">Theme</h1>
      <p class="admin-page-desc">
        Set the instance theme. This applies to all users. Individual users can toggle between light and dark mode.
      </p>
    </div>

    <div v-if="saveSuccess" class="admin-theme-toast">
      <i class="fa-solid fa-check"></i> Saved
    </div>

    <p v-if="pending" class="admin-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading theme settings...</p>

    <!-- Theme Families -->
    <section v-else class="admin-theme-families">
      <div v-for="family in families" :key="family.id" class="admin-family-card" :class="{ active: activeFamily === family.id }" >
        <button
          class="admin-family-select"
          :disabled="saving"
          @click="selectFamily(family)"
        >
          <div class="admin-family-previews">
            <!-- Light preview -->
            <div
              v-if="family.light"
              class="admin-family-preview"
              :style="{ backgroundColor: family.preview.light.bg, borderColor: family.preview.light.border }"
            >
              <div
                class="admin-preview-card"
                :style="{
                  backgroundColor: family.preview.light.surface,
                  borderColor: family.preview.light.border,
                  boxShadow: `3px 3px 0 ${family.preview.light.border}`,
                }"
              >
                <div class="admin-preview-heading" :style="{ backgroundColor: family.preview.light.text, opacity: 0.8 }"></div>
                <div class="admin-preview-text" :style="{ backgroundColor: family.preview.light.text, opacity: 0.3 }"></div>
                <div class="admin-preview-accent" :style="{ backgroundColor: family.preview.light.accent }"></div>
              </div>
            </div>
            <!-- Dark preview -->
            <div
              v-if="family.dark"
              class="admin-family-preview"
              :style="{ backgroundColor: family.preview.dark.bg, borderColor: family.preview.dark.border }"
            >
              <div
                class="admin-preview-card"
                :style="{
                  backgroundColor: family.preview.dark.surface,
                  borderColor: family.preview.dark.border,
                  boxShadow: `3px 3px 0 ${family.preview.dark.border}`,
                }"
              >
                <div class="admin-preview-heading" :style="{ backgroundColor: family.preview.dark.text, opacity: 0.8 }"></div>
                <div class="admin-preview-text" :style="{ backgroundColor: family.preview.dark.text, opacity: 0.3 }"></div>
                <div class="admin-preview-accent" :style="{ backgroundColor: family.preview.dark.accent }"></div>
              </div>
            </div>
          </div>

          <div class="admin-family-meta">
            <span class="admin-family-name">{{ family.name }}</span>
            <span class="admin-family-desc">{{ family.description }}</span>
            <span v-if="activeFamily === family.id" class="admin-family-active">
              <i class="fa-solid fa-check"></i> Active
            </span>
          </div>
        </button>
      </div>
    </section>

    <!-- Token Overrides -->
    <section class="admin-theme-overrides">
      <h2 class="admin-section-title">Token Overrides</h2>
      <p class="admin-section-desc">
        Override individual CSS tokens instance-wide. These apply on top of the selected theme.
        Use CSS values (colors, font families, sizes).
      </p>

      <div class="admin-overrides-list" v-if="Object.keys(tokenOverrides).length > 0">
        <div v-for="(value, key) in tokenOverrides" :key="key" class="admin-override-row">
          <code class="admin-override-key">--{{ key }}</code>
          <span class="admin-override-value">
            <span
              v-if="String(value).startsWith('#') || String(value).startsWith('rgb')"
              class="admin-override-swatch"
              :style="{ backgroundColor: String(value) }"
            ></span>
            {{ value }}
          </span>
          <button
            class="cpub-btn cpub-btn-sm admin-override-remove"
            aria-label="Remove override"
            @click="removeTokenOverride(key as string)"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="admin-override-add">
        <input
          v-model="newTokenKey"
          class="admin-override-input"
          placeholder="Token name (e.g. accent)"
          @keyup.enter="addTokenOverride"
        />
        <input
          v-model="newTokenValue"
          class="admin-override-input"
          placeholder="Value (e.g. #ff6600)"
          @keyup.enter="addTokenOverride"
        />
        <button class="cpub-btn cpub-btn-sm" :disabled="!newTokenKey.trim() || !newTokenValue.trim()" @click="addTokenOverride">
          Add
        </button>
      </div>

      <div class="admin-override-actions">
        <button class="cpub-btn cpub-btn-primary" :disabled="saving" @click="saveTokenOverrides">
          <i class="fa-solid fa-floppy-disk"></i> Save Overrides
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-theme { max-width: 900px; }

.admin-theme-header { margin-bottom: var(--space-6); }
.admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.admin-page-desc { font-size: var(--text-sm); color: var(--text-dim); }

.admin-theme-toast {
  position: fixed;
  top: calc(var(--nav-height) + var(--space-4));
  right: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--green);
  color: var(--color-text-inverse);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  z-index: var(--z-toast);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.admin-section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.admin-section-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin-bottom: var(--space-4);
}

/* Theme families */
.admin-theme-families {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.admin-family-card {
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.admin-family-card.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.admin-family-card:hover {
  border-color: var(--border);
}

.admin-family-select {
  display: flex;
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
}

.admin-family-select:disabled {
  opacity: 0.6;
  cursor: wait;
}

.admin-family-previews {
  display: flex;
  flex-shrink: 0;
}

.admin-family-preview {
  width: 140px;
  height: 100px;
  padding: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: var(--border-width-default) solid var(--border2);
}

.admin-preview-card {
  width: 80%;
  padding: var(--space-2) var(--space-3);
  border-width: 2px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-preview-heading { height: 5px; width: 55%; }
.admin-preview-text { height: 3px; width: 85%; }
.admin-preview-accent { height: 12px; width: 40%; margin-top: 4px; }

.admin-family-meta {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.admin-family-name {
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
}

.admin-family-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-snug);
}

.admin-family-active {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--accent);
  margin-top: var(--space-1);
}

/* Token overrides */
.admin-theme-overrides {
  border-top: var(--border-width-default) solid var(--border);
  padding-top: var(--space-6);
}

.admin-overrides-list {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  margin-bottom: var(--space-4);
}

.admin-override-row {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-default) solid var(--border2);
  gap: var(--space-3);
}

.admin-override-row:last-child { border-bottom: none; }

.admin-override-key {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--accent);
  flex-shrink: 0;
}

.admin-override-value {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-override-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: var(--border-width-default) solid var(--border2);
  flex-shrink: 0;
}

.admin-override-remove {
  flex-shrink: 0;
  padding: var(--space-1);
  color: var(--text-faint);
}

.admin-override-remove:hover { color: var(--red); }

.admin-override-add {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 2px dashed var(--border2);
  background: var(--surface);
}

.admin-override-input {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-family: var(--font-mono);
  flex: 1;
  min-width: 0;
}

.admin-override-actions {
  margin-top: var(--space-4);
}

@media (max-width: 640px) {
  .admin-family-select { flex-direction: column; }
  .admin-family-previews { width: 100%; }
  .admin-family-preview { flex: 1; border-right: none; border-bottom: var(--border-width-default) solid var(--border2); }
  .admin-override-add { flex-direction: column; }
}
</style>
