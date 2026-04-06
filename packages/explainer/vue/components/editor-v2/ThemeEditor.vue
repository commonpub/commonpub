<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ExplainerThemePreset, ExplainerThemeRef, ExplainerThemeTokens } from '@commonpub/explainer';
import { resolveThemePreset, resolveThemeOverrides } from '@commonpub/explainer';

const PRESETS: Array<{ id: ExplainerThemePreset; name: string; accent: string; bg: string }> = [
  { id: 'dark-industrial', name: 'Dark Industrial', accent: '#e04030', bg: '#0c0c0f' },
  { id: 'punk-zine', name: 'Punk Zine', accent: '#ff3366', bg: '#1a1a1a' },
  { id: 'paper-teal', name: 'Paper Teal', accent: '#2dd4a8', bg: '#faf8f3' },
  { id: 'clean-light', name: 'Clean Light', accent: '#3b82f6', bg: '#ffffff' },
];

const DISPLAY_FONTS = [
  { value: "'Space Grotesk', system-ui, sans-serif", label: 'Space Grotesk' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: "'Sora', system-ui, sans-serif", label: 'Sora' },
  { value: "'Outfit', system-ui, sans-serif", label: 'Outfit' },
  { value: "'DM Sans', system-ui, sans-serif", label: 'DM Sans' },
  { value: "'Rubik', system-ui, sans-serif", label: 'Rubik' },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: 'Plus Jakarta Sans' },
  { value: "'Fraunces', serif", label: 'Fraunces' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Permanent Marker', cursive", label: 'Permanent Marker' },
  { value: "'Special Elite', monospace", label: 'Special Elite' },
];

const MONO_FONTS = [
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono' },
  { value: "'IBM Plex Mono', ui-monospace, monospace", label: 'IBM Plex Mono' },
  { value: "'Space Mono', ui-monospace, monospace", label: 'Space Mono' },
  { value: "'Fira Code', ui-monospace, monospace", label: 'Fira Code' },
  { value: "'Source Code Pro', ui-monospace, monospace", label: 'Source Code Pro' },
  { value: "'VT323', monospace", label: 'VT323' },
  { value: "'Inconsolata', monospace", label: 'Inconsolata' },
];

const props = defineProps<{
  theme: ExplainerThemeRef;
}>();

const emit = defineEmits<{
  'update:theme': [theme: ExplainerThemeRef];
  close: [];
}>();

const preset = computed(() => resolveThemePreset(props.theme));
const overrides = computed(() => resolveThemeOverrides(props.theme));

function setPreset(id: ExplainerThemePreset): void {
  // Keep existing overrides when switching preset
  const current = resolveThemeOverrides(props.theme);
  if (Object.keys(current).length > 0) {
    emit('update:theme', { preset: id, overrides: current });
  } else {
    emit('update:theme', id);
  }
}

function setOverride(key: keyof ExplainerThemeTokens, value: string): void {
  const current = { ...resolveThemeOverrides(props.theme) };
  if (value) {
    current[key] = value;
  } else {
    delete current[key];
  }
  // Auto-derive accent variants
  if (key === 'accent' && value) {
    current['accent-hover'] = darkenHex(value, 0.12);
    current['accent-light'] = hexToRgba(value, 0.08);
    current['accent-glow'] = hexToRgba(value, 0.25);
  }
  // Auto-construct font-import URL
  if (key === 'font-display' || key === 'font-body' || key === 'font-ui') {
    current['font-import'] = buildFontUrl(
      current['font-display'],
      current['font-body'],
      current['font-ui'],
    );
  }
  if (Object.keys(current).length > 0) {
    emit('update:theme', { preset: preset.value, overrides: current });
  } else {
    emit('update:theme', preset.value);
  }
}

function resetOverrides(): void {
  emit('update:theme', preset.value);
}

const hasOverrides = computed(() => Object.keys(overrides.value).length > 0);

// Color helpers
function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, '0')}${Math.round(g * f).toString(16).padStart(2, '0')}${Math.round(b * f).toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildFontUrl(...fontValues: (string | undefined)[]): string {
  const families = new Set<string>();
  for (const val of fontValues) {
    if (!val) continue;
    const match = val.match(/^'([^']+)'/);
    if (match) families.add(match[1]!);
  }
  if (families.size === 0) return '';
  const params = [...families].map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
</script>

<template>
  <div class="cpub-theme-editor">
    <!-- Preset selector -->
    <div class="cpub-te-presets">
      <span class="cpub-te-group-label">Preset</span>
      <div class="cpub-te-preset-row">
        <button
          v-for="p in PRESETS"
          :key="p.id"
          class="cpub-te-preset-card"
          :class="{ 'cpub-te-preset-active': preset === p.id }"
          @click="setPreset(p.id)"
        >
          <span class="cpub-te-preset-dot" :style="{ background: p.accent }" />
          <span class="cpub-te-preset-name">{{ p.name }}</span>
        </button>
      </div>
    </div>

    <div class="cpub-te-columns">
      <!-- COLORS -->
      <div class="cpub-te-column">
        <span class="cpub-te-group-label">Colors</span>

        <div class="cpub-te-color-field">
          <label>Accent</label>
          <div class="cpub-te-color-input">
            <input type="color" :value="(overrides.accent as string) || PRESETS.find(p => p.id === preset)?.accent || '#e04030'" @input="setOverride('accent', ($event.target as HTMLInputElement).value)" class="cpub-te-color-picker" />
            <input type="text" :value="overrides.accent || ''" placeholder="Preset" @change="setOverride('accent', ($event.target as HTMLInputElement).value)" class="cpub-te-hex-input" />
          </div>
        </div>

        <div class="cpub-te-color-field">
          <label>Page Background</label>
          <div class="cpub-te-color-input">
            <input type="color" :value="(overrides['bg-page'] as string) || PRESETS.find(p => p.id === preset)?.bg || '#0c0c0f'" @input="setOverride('bg-page', ($event.target as HTMLInputElement).value)" class="cpub-te-color-picker" />
            <input type="text" :value="overrides['bg-page'] || ''" placeholder="Preset" @change="setOverride('bg-page', ($event.target as HTMLInputElement).value)" class="cpub-te-hex-input" />
          </div>
        </div>

        <div class="cpub-te-color-field">
          <label>Section Background</label>
          <div class="cpub-te-color-input">
            <input type="color" :value="(overrides['bg-section'] as string) || '#fafaf8'" @input="setOverride('bg-section', ($event.target as HTMLInputElement).value)" class="cpub-te-color-picker" />
            <input type="text" :value="overrides['bg-section'] || ''" placeholder="Preset" @change="setOverride('bg-section', ($event.target as HTMLInputElement).value)" class="cpub-te-hex-input" />
          </div>
        </div>

        <div class="cpub-te-color-field">
          <label>Interactive Box</label>
          <div class="cpub-te-color-input">
            <input type="color" :value="(overrides['bg-dark'] as string) || '#141418'" @input="setOverride('bg-dark', ($event.target as HTMLInputElement).value)" class="cpub-te-color-picker" />
            <input type="text" :value="overrides['bg-dark'] || ''" placeholder="Preset" @change="setOverride('bg-dark', ($event.target as HTMLInputElement).value)" class="cpub-te-hex-input" />
          </div>
        </div>
      </div>

      <!-- TYPOGRAPHY -->
      <div class="cpub-te-column">
        <span class="cpub-te-group-label">Typography</span>

        <div class="cpub-te-font-field">
          <label>Display Font</label>
          <select class="cpub-te-font-select" :value="overrides['font-display'] || ''" @change="setOverride('font-display', ($event.target as HTMLSelectElement).value)">
            <option value="">Preset</option>
            <option v-for="f in DISPLAY_FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
          <span class="cpub-te-font-preview" :style="{ fontFamily: overrides['font-display'] || 'inherit' }">The quick brown fox</span>
        </div>

        <div class="cpub-te-font-field">
          <label>Body Font</label>
          <select class="cpub-te-font-select" :value="overrides['font-body'] || ''" @change="setOverride('font-body', ($event.target as HTMLSelectElement).value)">
            <option value="">Preset</option>
            <option v-for="f in DISPLAY_FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>

        <div class="cpub-te-font-field">
          <label>UI / Mono Font</label>
          <select class="cpub-te-font-select" :value="overrides['font-ui'] || ''" @change="setOverride('font-ui', ($event.target as HTMLSelectElement).value)">
            <option value="">Preset</option>
            <option v-for="f in MONO_FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>

      <!-- SHAPE -->
      <div class="cpub-te-column">
        <span class="cpub-te-group-label">Shape</span>

        <div class="cpub-te-slider-field">
          <label>Border Radius</label>
          <div class="cpub-te-slider-row">
            <input type="range" min="0" max="12" step="1" :value="parseInt(overrides.radius || '0') || 0" @input="setOverride('radius', ($event.target as HTMLInputElement).value + 'px')" class="cpub-te-slider" />
            <span class="cpub-te-slider-value">{{ overrides.radius || 'Preset' }}</span>
          </div>
        </div>

        <div class="cpub-te-slider-field">
          <label>Border Width</label>
          <div class="cpub-te-slider-row">
            <input type="range" min="0" max="3" step="1" :value="parseInt(overrides['border-width'] || '0') || 0" @input="setOverride('border-width', ($event.target as HTMLInputElement).value + 'px')" class="cpub-te-slider" />
            <span class="cpub-te-slider-value">{{ overrides['border-width'] || 'Preset' }}</span>
          </div>
        </div>

        <div class="cpub-te-actions">
          <button v-if="hasOverrides" class="cpub-te-reset" @click="resetOverrides">
            <i class="fa-solid fa-rotate-left" /> Reset to Preset
          </button>
          <span v-if="hasOverrides" class="cpub-te-override-count">{{ Object.keys(overrides).length }} overrides</span>
        </div>
      </div>
    </div>

    <button class="cpub-te-close" @click="emit('close')" aria-label="Close theme editor">
      <i class="fa-solid fa-chevron-up" /> Close
    </button>
  </div>
</template>

<style scoped>
.cpub-theme-editor {
  background: var(--surface, #101014);
  border-bottom: 2px solid var(--accent, #e04030);
  padding: 12px 16px;
}

.cpub-te-presets { margin-bottom: 12px; }

.cpub-te-preset-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.cpub-te-preset-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  cursor: pointer;
  font-size: 11px;
  transition: border-color 0.15s;
}

.cpub-te-preset-card:hover { border-color: rgba(255,255,255,0.2); }

.cpub-te-preset-active {
  border-color: var(--accent, #e04030);
  background: rgba(224, 64, 48, 0.06);
}

.cpub-te-preset-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cpub-te-preset-name {
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  white-space: nowrap;
}

.cpub-te-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.cpub-te-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-te-group-label {
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint, #666);
}

/* Color fields */
.cpub-te-color-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cpub-te-color-field label {
  font-size: 10px;
  color: var(--text-dim, #999);
}

.cpub-te-color-input {
  display: flex;
  gap: 4px;
  align-items: center;
}

.cpub-te-color-picker {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border, #333);
  padding: 0;
  cursor: pointer;
  background: none;
  -webkit-appearance: none;
}

.cpub-te-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.cpub-te-color-picker::-webkit-color-swatch { border: none; }

.cpub-te-hex-input {
  flex: 1;
  padding: 3px 6px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  font-family: var(--font-ui, monospace);
  font-size: 11px;
  outline: none;
}

.cpub-te-hex-input:focus { border-color: var(--accent, #e04030); }

/* Font fields */
.cpub-te-font-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cpub-te-font-field label {
  font-size: 10px;
  color: var(--text-dim, #999);
}

.cpub-te-font-select {
  padding: 4px 6px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  font-size: 11px;
  outline: none;
}

.cpub-te-font-select:focus { border-color: var(--accent, #e04030); }

.cpub-te-font-preview {
  font-size: 12px;
  color: var(--text-dim, #999);
  padding: 2px 0;
  min-height: 16px;
}

/* Sliders */
.cpub-te-slider-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cpub-te-slider-field label {
  font-size: 10px;
  color: var(--text-dim, #999);
}

.cpub-te-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-te-slider {
  flex: 1;
  accent-color: var(--accent, #e04030);
}

.cpub-te-slider-value {
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  color: var(--accent, #e04030);
  min-width: 40px;
  text-align: right;
}

/* Actions */
.cpub-te-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.cpub-te-reset {
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--border, #333);
  color: var(--text-dim, #999);
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-te-reset:hover { color: var(--accent, #e04030); border-color: var(--accent, #e04030); }

.cpub-te-override-count {
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  color: var(--text-faint, #666);
}

.cpub-te-close {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 10px;
  padding: 5px;
  background: none;
  border: 1px solid var(--border, #333);
  color: var(--text-faint, #666);
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cpub-te-close:hover { color: var(--text, #ccc); border-color: var(--accent, #e04030); }

@media (max-width: 768px) {
  .cpub-te-columns { grid-template-columns: 1fr; }
  .cpub-te-preset-row { flex-wrap: wrap; }
}
</style>
