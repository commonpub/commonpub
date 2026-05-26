<script setup lang="ts">
/**
 * One row in the admin theme picker. Displays:
 *   • light + dark swatches (each clickable to pick that variant directly)
 *   • family name + description
 *   • active / current pill
 *   • action buttons: Edit (custom only), Duplicate, Export, Delete
 *
 * Stays presentational — all wiring (select / edit / duplicate / delete /
 * export) is emitted up so the page owns the state machine.
 */
import type { ThemeFamilyView } from '../../../types/theme';

defineProps<{
  family: ThemeFamilyView;
  active: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  select: [themeId: string];
  edit: [themeId: string];
  duplicate: [themeId: string];
  exportTheme: [themeId: string];
  remove: [themeId: string];
}>();

function variantBoxStyle(v: { bg: string; surface: string; accent: string; text: string; border: string }) {
  return {
    backgroundColor: v.bg,
    borderColor: v.border,
  };
}

function variantInnerStyle(v: { bg: string; surface: string; accent: string; text: string; border: string }) {
  return {
    backgroundColor: v.surface,
    borderColor: v.border,
    boxShadow: `3px 3px 0 ${v.border}`,
  };
}

function badge(family: ThemeFamilyView): { label: string; tone: 'builtin' | 'registered' | 'custom' } {
  if (family.source === 'custom') return { label: 'Custom', tone: 'custom' };
  if (family.source === 'registered') return { label: 'From code', tone: 'registered' };
  return { label: 'Built-in', tone: 'builtin' };
}
</script>

<template>
  <article class="theme-family-card" :class="{ active }">
    <div class="theme-family-previews">
      <button
        v-if="family.light"
        type="button"
        class="theme-family-preview"
        :style="variantBoxStyle(family.preview.light)"
        :disabled="saving"
        :aria-label="`Select ${family.name} light`"
        @click="emit('select', family.light.id)"
      >
        <div class="theme-family-preview-card" :style="variantInnerStyle(family.preview.light)">
          <div class="theme-family-preview-heading" :style="{ backgroundColor: family.preview.light.text, opacity: 0.85 }" />
          <div class="theme-family-preview-text" :style="{ backgroundColor: family.preview.light.text, opacity: 0.35 }" />
          <div class="theme-family-preview-text" :style="{ backgroundColor: family.preview.light.text, opacity: 0.35, width: '60%' }" />
          <div class="theme-family-preview-accent" :style="{ backgroundColor: family.preview.light.accent }" />
        </div>
        <span class="theme-family-mode-label">Light</span>
      </button>

      <button
        v-if="family.dark"
        type="button"
        class="theme-family-preview theme-family-preview-dark"
        :style="variantBoxStyle(family.preview.dark)"
        :disabled="saving"
        :aria-label="`Select ${family.name} dark`"
        @click="emit('select', family.dark.id)"
      >
        <div class="theme-family-preview-card" :style="variantInnerStyle(family.preview.dark)">
          <div class="theme-family-preview-heading" :style="{ backgroundColor: family.preview.dark.text, opacity: 0.85 }" />
          <div class="theme-family-preview-text" :style="{ backgroundColor: family.preview.dark.text, opacity: 0.35 }" />
          <div class="theme-family-preview-text" :style="{ backgroundColor: family.preview.dark.text, opacity: 0.35, width: '60%' }" />
          <div class="theme-family-preview-accent" :style="{ backgroundColor: family.preview.dark.accent }" />
        </div>
        <span class="theme-family-mode-label">Dark</span>
      </button>
    </div>

    <div class="theme-family-meta">
      <div class="theme-family-meta-head">
        <h3 class="theme-family-name">{{ family.name }}</h3>
        <span class="theme-family-tag" :class="`tag-${badge(family).tone}`">{{ badge(family).label }}</span>
        <span v-if="active" class="theme-family-active">
          <i class="fa-solid fa-check" aria-hidden="true" /> Active
        </span>
      </div>
      <p class="theme-family-desc">{{ family.description }}</p>

      <div class="theme-family-actions">
        <button
          v-if="family.source === 'custom'"
          type="button"
          class="cpub-btn cpub-btn-sm"
          @click="emit('edit', family.light?.id ?? family.dark!.id)"
        >
          <i class="fa-solid fa-pen-to-square" aria-hidden="true" /> Edit
        </button>
        <button
          type="button"
          class="cpub-btn cpub-btn-sm"
          :title="family.source === 'custom' ? 'Duplicate this theme' : 'Fork to a new editable custom theme'"
          @click="emit('duplicate', family.light?.id ?? family.dark!.id)"
        >
          <i class="fa-solid fa-copy" aria-hidden="true" /> {{ family.source === 'custom' ? 'Duplicate' : 'Fork' }}
        </button>
        <button
          v-if="family.source === 'custom'"
          type="button"
          class="cpub-btn cpub-btn-sm"
          @click="emit('exportTheme', family.light?.id ?? family.dark!.id)"
        >
          <i class="fa-solid fa-file-export" aria-hidden="true" /> Export
        </button>
        <button
          v-if="family.source === 'custom'"
          type="button"
          class="cpub-btn cpub-btn-sm theme-family-action-danger"
          @click="emit('remove', family.light?.id ?? family.dark!.id)"
        >
          <i class="fa-solid fa-trash" aria-hidden="true" /> Delete
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.theme-family-card {
  display: grid;
  grid-template-columns: auto 1fr;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.theme-family-card.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.theme-family-card:hover { border-color: var(--border); }

.theme-family-previews {
  display: flex;
  border-right: var(--border-width-default) solid var(--border2);
}

.theme-family-preview {
  position: relative;
  width: 130px;
  height: 110px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0;
  border-right: var(--border-width-default) solid var(--border2);
  cursor: pointer;
  border-radius: 0;
}

.theme-family-preview:last-child { border-right: 0; }
.theme-family-preview:hover { filter: brightness(1.05); }
.theme-family-preview:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.theme-family-preview:disabled { cursor: wait; opacity: 0.6; }

.theme-family-preview-card {
  width: 80%;
  padding: var(--space-2) var(--space-3);
  border-width: 2px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 0;
}

.theme-family-preview-heading { height: 5px; width: 55%; border-radius: 0; }
.theme-family-preview-text { height: 3px; width: 85%; border-radius: 0; }
.theme-family-preview-accent { height: 10px; width: 40%; margin-top: 4px; border-radius: 0; }

.theme-family-mode-label {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-faint);
  opacity: 0.7;
}

.theme-family-meta {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.theme-family-meta-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.theme-family-name {
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.theme-family-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  padding: 2px 6px;
  border: var(--border-width-thin) solid var(--border2);
  color: var(--text-dim);
}
.tag-custom { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.tag-registered { color: var(--purple); border-color: var(--purple-border); background: var(--purple-bg); }

.theme-family-active {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--accent);
  font-weight: var(--font-weight-semibold);
}

.theme-family-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
  line-height: var(--leading-snug);
}

.theme-family-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: auto;
}

.theme-family-action-danger {
  color: var(--red);
  border-color: var(--red-border);
}
.theme-family-action-danger:hover { background: var(--red-bg); }

@media (max-width: 640px) {
  .theme-family-card { grid-template-columns: 1fr; }
  .theme-family-previews { border-right: 0; border-bottom: var(--border-width-default) solid var(--border2); }
  .theme-family-preview { flex: 1; }
}
</style>
