<script setup lang="ts">
/**
 * ContestBannerAdjust — non-destructive framing control for a contest banner or
 * cover (P4). Three explicit modes so the choice (and what persists) is never
 * ambiguous:
 *   • Fill (default)  → meta = null  → object-fit: cover (fills the band, crops).
 *   • Fit (whole)     → meta = {zoom:0} → the WHOLE image shows (no crop). On the
 *                        public hero the band grows to the image; here it previews
 *                        contained.
 *   • Zoom            → meta = {zoom>0, x, y} → cover + scale + drag-to-reposition.
 *
 * The earlier single slider defaulted a null banner to the "Fit" position without
 * persisting it (moving the slider to where it already sat emitted nothing), so a
 * banner that looked "set to Fit" stayed null → cover → cropped. Explicit mode
 * buttons each emit a concrete value, which fixes that. Render parity with the
 * public hero is via the shared `imageFramingStyle` / `isWholeImage`.
 */
import type { ContestImageMeta } from '@commonpub/schema';
import { imageFramingStyle } from '../../utils/contestImage';

defineProps<{
  imageUrl: string;
  /** CSS aspect-ratio for the preview box, e.g. '4 / 1' (banner), '4 / 3' (cover). */
  aspect?: string;
  label?: string;
}>();
const meta = defineModel<ContestImageMeta | null>({ default: null });

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 1.5;
const ZOOM_DEFAULT = 0.3;

type Mode = 'fill' | 'fit' | 'zoom';
const mode = computed<Mode>(() => {
  if (!meta.value) return 'fill';
  return meta.value.zoom <= 0 ? 'fit' : 'zoom';
});
const framing = computed(() => imageFramingStyle(meta.value));
const pos = computed(() => ({ x: meta.value?.x ?? 50, y: meta.value?.y ?? 50 }));

function setMode(next: Mode): void {
  if (next === 'fill') meta.value = null;
  else if (next === 'fit') meta.value = { zoom: 0, x: pos.value.x, y: pos.value.y };
  else meta.value = { zoom: meta.value && meta.value.zoom > 0 ? meta.value.zoom : ZOOM_DEFAULT, x: pos.value.x, y: pos.value.y };
}
function onZoom(e: Event): void {
  const zoom = Math.max(ZOOM_MIN, Number((e.target as HTMLInputElement).value));
  meta.value = { zoom, x: pos.value.x, y: pos.value.y };
}

const MODES: { key: Mode; label: string; icon: string; hint: string }[] = [
  { key: 'fill', label: 'Fill', icon: 'fa-expand', hint: 'Fills the banner and crops the edges.' },
  { key: 'fit', label: 'Fit', icon: 'fa-compress', hint: 'Shows the whole image, never cropped.' },
  { key: 'zoom', label: 'Zoom', icon: 'fa-magnifying-glass-plus', hint: 'Zoom in and drag to choose what shows.' },
];
const activeHint = computed(() => MODES.find((m) => m.key === mode.value)?.hint ?? '');

// ─── Drag to reposition (Zoom mode only) ───
const boxRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
let startX = 0;
let startY = 0;
let startPosX = 50;
let startPosY = 50;

function onPointerDown(e: PointerEvent): void {
  if (mode.value !== 'zoom' || !boxRef.value) return;
  dragging.value = true;
  startX = e.clientX;
  startY = e.clientY;
  startPosX = pos.value.x;
  startPosY = pos.value.y;
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || !boxRef.value || !meta.value) return;
  const rect = boxRef.value.getBoundingClientRect();
  // A zero-size rect (element not laid out, e.g. display:none mid-drag) would make
  // the normalized delta explode against the Math.max(1, …) floor — skip the frame.
  if (rect.width === 0 || rect.height === 0) return;
  const dx = ((e.clientX - startX) / Math.max(1, rect.width)) * 100;
  const dy = ((e.clientY - startY) / Math.max(1, rect.height)) * 100;
  meta.value = { zoom: meta.value.zoom, x: clamp(startPosX - dx), y: clamp(startPosY - dy) };
}
function onPointerUp(): void {
  dragging.value = false;
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
onUnmounted(() => {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
});
</script>

<template>
  <div class="cpub-ba">
    <div class="cpub-ba-modes" role="group" :aria-label="`${label ?? 'Image'} framing`">
      <button
        v-for="m in MODES"
        :key="m.key"
        type="button"
        class="cpub-ba-mode"
        :class="{ 'cpub-ba-mode-active': mode === m.key }"
        :aria-pressed="mode === m.key"
        @click="setMode(m.key)"
      >
        <i class="fa-solid" :class="m.icon"></i> {{ m.label }}
      </button>
    </div>

    <div
      ref="boxRef"
      class="cpub-ba-box"
      :class="{ 'cpub-ba-drag': mode === 'zoom', 'cpub-ba-dragging': dragging }"
      :style="{ aspectRatio: aspect ?? '4 / 1' }"
      @pointerdown="onPointerDown"
    >
      <img :src="imageUrl" :alt="label ?? 'Image preview'" class="cpub-ba-img" :style="framing" draggable="false" />
      <span v-if="mode === 'zoom'" class="cpub-ba-hint"><i class="fa-solid fa-up-down-left-right"></i> Drag to reposition</span>
    </div>

    <label v-if="mode === 'zoom'" class="cpub-ba-zoom">
      <span class="cpub-ba-zoom-label">Zoom</span>
      <input
        type="range"
        :min="ZOOM_MIN"
        :max="ZOOM_MAX"
        step="0.05"
        :value="meta?.zoom ?? ZOOM_DEFAULT"
        :aria-label="`${label ?? 'Image'} zoom level`"
        @input="onZoom"
      />
    </label>

    <p class="cpub-ba-help">{{ activeHint }}</p>
  </div>
</template>

<style scoped>
.cpub-ba { display: flex; flex-direction: column; gap: 8px; }
.cpub-ba-modes { display: inline-flex; border: var(--border-width-default) solid var(--border); align-self: flex-start; }
.cpub-ba-mode { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; background: transparent; border: none; border-right: var(--border-width-default) solid var(--border); cursor: pointer; font-size: var(--text-xs); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .04em; color: var(--text-faint); }
.cpub-ba-mode:last-child { border-right: none; }
.cpub-ba-mode:hover { background: var(--surface2); color: var(--text-dim); }
.cpub-ba-mode:focus-visible { outline: var(--border-width-default) solid var(--accent); outline-offset: -2px; color: var(--text-dim); }
.cpub-ba-mode-active { background: var(--accent-bg); color: var(--accent); }
.cpub-ba-box { position: relative; width: 100%; overflow: hidden; border: var(--border-width-default) solid var(--border); background: var(--surface2); touch-action: none; }
.cpub-ba-drag { cursor: grab; }
.cpub-ba-dragging { cursor: grabbing; }
.cpub-ba-img { display: block; width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; }
.cpub-ba-hint { position: absolute; left: 8px; bottom: 8px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text); background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 3px 7px; display: inline-flex; align-items: center; gap: 5px; opacity: .85; pointer-events: none; }
.cpub-ba-zoom { display: flex; align-items: center; gap: 8px; }
.cpub-ba-zoom-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); white-space: nowrap; }
.cpub-ba-zoom input[type='range'] { flex: 1; accent-color: var(--accent); }
.cpub-ba-help { margin: 0; font-size: 11px; color: var(--text-faint); line-height: 1.5; }
</style>
