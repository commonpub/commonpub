<script setup lang="ts">
/**
 * ContestBannerAdjust — non-destructive framing control for a contest banner or
 * cover (P4). A live preview at the target aspect ratio + a zoom slider (0 = fit/
 * contain) + drag-to-reposition. Writes a `ContestImageMeta` ({ zoom, x, y })
 * v-model; the original image is never re-cropped. Render parity with the public
 * hero is guaranteed by sharing `imageFramingStyle` (utils/contestImage.ts).
 */
import type { ContestImageMeta } from '@commonpub/schema';
import { imageFramingStyle, defaultImageMeta } from '../../utils/contestImage';

defineProps<{
  imageUrl: string;
  /** CSS aspect-ratio for the preview box, e.g. '4 / 1' (banner), '4 / 3' (cover). */
  aspect?: string;
  label?: string;
}>();
const meta = defineModel<ContestImageMeta | null>({ default: null });

const ZOOM_MAX = 1.5;
const current = computed<ContestImageMeta>(() => meta.value ?? defaultImageMeta());
const framing = computed(() => imageFramingStyle(meta.value));

function patch(p: Partial<ContestImageMeta>): void {
  meta.value = { ...current.value, ...p };
}
function onZoom(e: Event): void {
  patch({ zoom: Number((e.target as HTMLInputElement).value) });
}
function reset(): void {
  meta.value = null;
}

// ─── Drag to reposition (sets x/y as percent) ───
const boxRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
let startX = 0;
let startY = 0;
let startPosX = 50;
let startPosY = 50;

function onPointerDown(e: PointerEvent): void {
  if (!boxRef.value) return;
  dragging.value = true;
  startX = e.clientX;
  startY = e.clientY;
  startPosX = current.value.x;
  startPosY = current.value.y;
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || !boxRef.value) return;
  const rect = boxRef.value.getBoundingClientRect();
  // Drag right reveals the LEFT of the image (object-position decreases), so invert.
  const dx = ((e.clientX - startX) / Math.max(1, rect.width)) * 100;
  const dy = ((e.clientY - startY) / Math.max(1, rect.height)) * 100;
  patch({ x: clamp(startPosX - dx), y: clamp(startPosY - dy) });
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

const zoomLabel = computed(() => (current.value.zoom <= 0 ? 'Fit' : `${Math.round(current.value.zoom * 100)}%`));
</script>

<template>
  <div class="cpub-ba">
    <div
      ref="boxRef"
      class="cpub-ba-box"
      :class="{ 'cpub-ba-drag': dragging }"
      :style="{ aspectRatio: aspect ?? '4 / 1' }"
      @pointerdown="onPointerDown"
    >
      <img :src="imageUrl" :alt="label ?? 'Image preview'" class="cpub-ba-img" :style="framing" draggable="false" />
      <span class="cpub-ba-hint"><i class="fa-solid fa-up-down-left-right"></i> Drag to reposition</span>
    </div>
    <div class="cpub-ba-controls">
      <label class="cpub-ba-zoom">
        <span class="cpub-ba-zoom-label">Zoom <strong>{{ zoomLabel }}</strong></span>
        <input
          type="range"
          min="0"
          :max="ZOOM_MAX"
          step="0.05"
          :value="current.zoom"
          :aria-label="`${label ?? 'Image'} zoom (0 is fit)`"
          @input="onZoom"
        />
      </label>
      <button type="button" class="cpub-btn cpub-btn-sm cpub-ba-reset" :disabled="!meta" @click="reset">
        <i class="fa-solid fa-rotate-left"></i> Reset
      </button>
    </div>
    <p class="cpub-ba-help">Zoom 0 fits the whole image. Increase to fill and crop; drag the preview to choose what shows.</p>
  </div>
</template>

<style scoped>
.cpub-ba { display: flex; flex-direction: column; gap: 8px; }
.cpub-ba-box { position: relative; width: 100%; overflow: hidden; border: var(--border-width-default) solid var(--border); background: var(--surface2); cursor: grab; touch-action: none; }
.cpub-ba-drag { cursor: grabbing; }
.cpub-ba-img { display: block; width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; }
.cpub-ba-hint { position: absolute; left: 8px; bottom: 8px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text); background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 3px 7px; display: inline-flex; align-items: center; gap: 5px; opacity: .85; pointer-events: none; }
.cpub-ba-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cpub-ba-zoom { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px; }
.cpub-ba-zoom-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); white-space: nowrap; }
.cpub-ba-zoom input[type='range'] { flex: 1; accent-color: var(--accent); }
.cpub-ba-reset { flex-shrink: 0; }
.cpub-ba-help { margin: 0; font-size: 11px; color: var(--text-faint); line-height: 1.5; }
</style>
