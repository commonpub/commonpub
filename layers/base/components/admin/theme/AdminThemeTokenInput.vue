<script setup lang="ts">
/**
 * One token row in the editor. Picks the input control based on the token
 * spec's `kind` and emits updates upward. Shows:
 *   • token name (mono)
 *   • description (faint, on its own line)
 *   • the appropriate input
 *   • a "reset to default" button when the value differs
 *
 * No prop drilling, no internal state — this is a pure controlled component.
 */
import type { TokenSpec } from '@commonpub/ui';
import { computed } from 'vue';

const props = defineProps<{
  spec: TokenSpec;
  value: string;
  /** Resolved value (after CSS resolution) for color preview when `value` is a var()
   *  or rgba expression. Optional — falls back to `value`. */
  resolvedValue?: string;
}>();

const emit = defineEmits<{
  update: [value: string];
  reset: [];
}>();

const isModified = computed(() => props.value !== props.spec.default && props.value !== '');

/** Returns a hex/rgb color that <input type="color"> understands; null if it can't. */
const colorPickerValue = computed<string | null>(() => {
  const v = (props.value || props.resolvedValue || props.spec.default).trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    // Expand 3-digit hex to 6-digit
    return '#' + v.slice(1).split('').map((c) => c + c).join('');
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  // rgb/rgba: extract first three numbers
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    return hex;
  }
  return null;
});

function onColorPick(e: Event): void {
  const next = (e.target as HTMLInputElement).value;
  emit('update', next);
}

function onTextChange(e: Event): void {
  emit('update', (e.target as HTMLInputElement | HTMLSelectElement).value);
}

// Number tokens (lengths) split into magnitude + unit for nicer editing
const NUMBER_UNITS = ['rem', 'px', 'em', '%', 'vh', 'vw', 'ch'] as const;
type LengthUnit = typeof NUMBER_UNITS[number] | '';
const lengthParts = computed<{ num: string; unit: LengthUnit }>(() => {
  const v = (props.value || props.spec.default).trim();
  const m = v.match(/^(-?\d*\.?\d+)\s*(rem|px|em|%|vh|vw|ch)?$/);
  if (m) return { num: m[1] ?? '', unit: (m[2] ?? '') as LengthUnit };
  return { num: '', unit: '' };
});

function commitLengthParts(num: string, unit: LengthUnit): void {
  if (num === '') return;
  emit('update', unit === '' ? num : `${num}${unit}`);
}

// Shadow tokens — exposed as raw string editing (composer is future work)
// Font weights — restricted dropdown
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
</script>

<template>
  <div class="token-row" :class="{ 'is-modified': isModified }">
    <div class="token-row-head">
      <code class="token-name">--{{ spec.key }}</code>
      <button
        v-if="isModified"
        type="button"
        class="token-reset"
        :title="`Reset to ${spec.default}`"
        @click="emit('reset')"
      >
        <i class="fa-solid fa-rotate-left" aria-hidden="true" />
      </button>
    </div>

    <p v-if="spec.description" class="token-desc">{{ spec.description }}</p>

    <!-- COLOR -->
    <div v-if="spec.kind === 'color'" class="token-input-color">
      <input
        v-if="colorPickerValue"
        type="color"
        class="token-color-swatch"
        :value="colorPickerValue"
        :aria-label="`${spec.key} color`"
        @input="onColorPick"
      />
      <div
        v-else
        class="token-color-swatch-fallback"
        :style="{ background: value || spec.default }"
        :title="value || spec.default"
        aria-hidden="true"
      />
      <input
        class="token-input"
        type="text"
        :value="value"
        :placeholder="spec.default"
        @input="onTextChange"
      />
    </div>

    <!-- LENGTH -->
    <div v-else-if="spec.kind === 'length'" class="token-input-length">
      <input
        class="token-input token-input-num"
        type="text"
        inputmode="decimal"
        :value="lengthParts.num"
        :placeholder="spec.default"
        @change="(e) => commitLengthParts((e.target as HTMLInputElement).value, lengthParts.unit)"
      />
      <select
        class="token-input token-input-unit"
        :value="lengthParts.unit"
        @change="(e) => commitLengthParts(lengthParts.num, (e.target as HTMLSelectElement).value as never)"
      >
        <option v-for="u in NUMBER_UNITS" :key="u" :value="u">{{ u }}</option>
        <option value="">—</option>
      </select>
      <input
        class="token-input token-input-raw"
        type="text"
        :value="value"
        :placeholder="spec.default"
        title="Or enter raw CSS"
        @change="onTextChange"
      />
    </div>

    <!-- NUMBER (unitless: weight, z-index, leading) -->
    <input
      v-else-if="spec.kind === 'number'"
      class="token-input"
      type="text"
      inputmode="decimal"
      :value="value"
      :placeholder="spec.default"
      @input="onTextChange"
    />

    <!-- FONT WEIGHT -->
    <select
      v-else-if="spec.kind === 'font-weight'"
      class="token-input"
      :value="value || spec.default"
      @change="onTextChange"
    >
      <option v-for="w in WEIGHTS" :key="w" :value="w">{{ w }}</option>
    </select>

    <!-- FONT FAMILY -->
    <input
      v-else-if="spec.kind === 'font-family'"
      class="token-input token-input-font"
      type="text"
      :value="value"
      :placeholder="spec.default"
      :style="{ fontFamily: value || spec.default }"
      @input="onTextChange"
    />

    <!-- SHADOW / TRANSITION / STRING — raw text -->
    <input
      v-else
      class="token-input token-input-mono"
      type="text"
      :value="value"
      :placeholder="spec.default"
      @input="onTextChange"
    />
  </div>
</template>

<style scoped>
.token-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-thin) solid var(--border2);
}
.token-row:last-child { border-bottom: 0; }
.token-row.is-modified { background: var(--accent-bg); }

.token-row-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.token-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text);
  font-weight: var(--font-weight-medium);
}

.token-reset {
  width: 22px;
  height: 22px;
  background: none;
  border: var(--border-width-thin) solid var(--border2);
  color: var(--text-dim);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-radius: 0;
}
.token-reset:hover { color: var(--accent); border-color: var(--accent); }

.token-desc {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
  line-height: var(--leading-snug);
}

.token-input {
  background: var(--surface2);
  color: var(--text);
  border: var(--border-width-thin) solid var(--border2);
  padding: 6px 8px;
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  width: 100%;
}
.token-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

.token-input-color { display: flex; align-items: center; gap: var(--space-2); }
.token-color-swatch {
  width: 36px;
  height: 30px;
  border: var(--border-width-thin) solid var(--border2);
  padding: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.token-color-swatch-fallback {
  width: 36px;
  height: 30px;
  border: var(--border-width-thin) solid var(--border2);
  flex-shrink: 0;
  background-image:
    linear-gradient(45deg, var(--border2) 25%, transparent 25%),
    linear-gradient(-45deg, var(--border2) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--border2) 75%),
    linear-gradient(-45deg, transparent 75%, var(--border2) 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.token-input-length { display: grid; grid-template-columns: 1fr 70px; gap: 4px; }
.token-input-length .token-input-raw { grid-column: 1 / -1; font-size: var(--text-xs); }

.token-input-font { font-size: var(--text-sm); }
.token-input-mono { font-family: var(--font-mono); font-size: var(--text-xs); }
</style>
