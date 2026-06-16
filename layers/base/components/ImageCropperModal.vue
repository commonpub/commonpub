<script setup lang="ts">
/**
 * Reusable image cropper modal. Shows a fixed aspect-ratio crop frame; the user
 * drags to reposition and zooms (slider / +/- / scroll / pinch) the image behind
 * it, so the crop is WYSIWYG for the target element (avatar 1:1, banner 4:1,
 * cover 16:9). Emits a cropped Blob. Built on vue-advanced-cropper for correct
 * EXIF/touch/retina handling; styled entirely to the design system.
 */
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const props = withDefaults(defineProps<{
  /** Source image as a data/object URL. */
  src: string;
  /** Crop aspect ratio (width / height), e.g. 1, 4, 16/9. */
  aspectRatio: number;
  /** Show a circular mask hint over the (still square) crop — for avatars.
   *  Avatars also export as PNG to preserve transparency (e.g. logos). */
  round?: boolean;
  /** Max output width in px; height derives from the aspect ratio. */
  outputWidth?: number;
  title?: string;
}>(), {
  round: false,
  outputWidth: 1600,
  title: 'Crop image',
});

const emit = defineEmits<{ crop: [blob: Blob]; cancel: [] }>();

// vue-advanced-cropper's instance methods (getResult/zoom) aren't in its exported
// types; reference them through a loose handle.
interface CropperHandle {
  getResult: () => { coordinates?: { width: number; height: number }; canvas?: HTMLCanvasElement };
  zoom: (factor: number) => void;
}
const cropperRef = ref<CropperHandle | null>(null);

// Modal a11y: focus trap, scroll lock, Esc, focus restore (shared pattern).
const dialogRef = ref<HTMLElement | null>(null);
const visible = ref(false);
onMounted(() => { visible.value = true; });
useFocusTrap(dialogRef, () => visible.value, () => emit('cancel'));

const ZOOM_MAX = 5;
const zoom = ref(1);
/** Crop width (in image px) at min zoom = "fit". image-restriction keeps the
 *  image covering the stencil, so this is the largest crop width ever seen. */
let fitCropWidth = 0;
const saving = ref(false);

// Reset zoom bookkeeping when the source image changes (defensive — today the
// parent remounts the modal per file, but don't rely on that).
watch(() => props.src, () => { fitCropWidth = 0; zoom.value = 1; });

const stencilProps = computed(() => ({
  aspectRatio: props.aspectRatio,
  movable: false,
  resizable: false,
  // The frame is fixed; the user manipulates the image, not the stencil. Don't
  // render resize handles/lines (they'd be dead, non-draggable decorations).
  handlers: {},
  lines: {},
}));

function stencilSize({ boundaries }: { boundaries: { width: number; height: number } }): { width: number; height: number } {
  let w = boundaries.width;
  let h = w / props.aspectRatio;
  if (h > boundaries.height) {
    h = boundaries.height;
    w = h * props.aspectRatio;
  }
  return { width: Math.round(w * 0.92), height: Math.round(h * 0.92) };
}

const exportMime = computed(() => (props.round ? 'image/png' : 'image/jpeg'));
const canvasOpts = computed(() => ({
  maxWidth: props.outputWidth,
  maxHeight: Math.round(props.outputWidth / props.aspectRatio),
  // Only flatten onto white for JPEG (no alpha). PNG keeps transparency.
  ...(props.round ? {} : { fillColor: '#ffffff' }),
}));

function onChange(result: { coordinates?: { width: number } }): void {
  const w = result?.coordinates?.width;
  if (!w) return;
  if (w > fitCropWidth) fitCropWidth = w;
  if (fitCropWidth > 0) zoom.value = Math.min(ZOOM_MAX, Math.max(1, fitCropWidth / w));
}

function applyZoom(target: number): void {
  const c = cropperRef.value;
  if (!c || !fitCropWidth) return;
  const curW = c.getResult().coordinates?.width;
  if (!curW) return;
  const t = Math.min(ZOOM_MAX, Math.max(1, target));
  const factor = curW / (fitCropWidth / t);
  if (Number.isFinite(factor) && factor > 0) c.zoom(factor);
}

function onSlider(e: Event): void { applyZoom(Number((e.target as HTMLInputElement).value)); }
function zoomIn(): void { applyZoom(zoom.value * 1.25); }
function zoomOut(): void { applyZoom(zoom.value / 1.25); }

function apply(): void {
  const c = cropperRef.value;
  if (!c) return;
  const { canvas } = c.getResult();
  if (!canvas) { emit('cancel'); return; }
  saving.value = true;
  canvas.toBlob((blob) => {
    saving.value = false;
    if (blob) emit('crop', blob); else emit('cancel');
  }, exportMime.value, 0.92);
}
</script>

<template>
  <Teleport to="body">
    <div class="cpub-crop-overlay" @click.self="emit('cancel')">
      <div ref="dialogRef" class="cpub-crop-modal" role="dialog" aria-modal="true" :aria-label="title">
        <header class="cpub-crop-head">
          <span class="cpub-crop-title">{{ title }}</span>
          <button type="button" class="cpub-crop-x" aria-label="Cancel" @click="emit('cancel')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div class="cpub-crop-stage" :class="{ 'cpub-crop-stage-round': round }">
          <Cropper
            ref="cropperRef"
            class="cpub-cropper"
            :src="src"
            :stencil-props="stencilProps"
            :stencil-size="stencilSize"
            image-restriction="stencil"
            :resize-image="{ touch: true, wheel: { ratio: 0.1 }, adjustStencil: false }"
            :move-image="{ touch: true, mouse: true }"
            :canvas="canvasOpts"
            :transitions="true"
            @change="onChange"
          />
          <div v-if="round" class="cpub-crop-round-mask" aria-hidden="true"></div>
        </div>

        <div class="cpub-crop-controls">
          <button type="button" class="cpub-crop-zbtn" aria-label="Zoom out" @click="zoomOut">
            <i class="fa-solid fa-minus"></i>
          </button>
          <input
            class="cpub-crop-slider"
            type="range"
            :min="1"
            :max="ZOOM_MAX"
            step="0.01"
            :value="zoom"
            aria-label="Zoom"
            @input="onSlider"
          />
          <button type="button" class="cpub-crop-zbtn" aria-label="Zoom in" @click="zoomIn">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>

        <p class="cpub-crop-hint">Drag to reposition. Scroll, pinch, or use the slider to zoom.</p>

        <footer class="cpub-crop-foot">
          <button type="button" class="cpub-btn" @click="emit('cancel')">Cancel</button>
          <button type="button" class="cpub-btn cpub-btn-primary" :disabled="saving" @click="apply">
            {{ saving ? 'Saving...' : 'Apply' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-crop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 9999);
  background: var(--color-surface-scrim, rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.cpub-crop-modal {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  border: var(--border-width-default, 2px) solid var(--border);
  box-shadow: var(--shadow-lg, 6px 6px 0 var(--border));
  display: flex;
  flex-direction: column;
}

.cpub-crop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: var(--border-width-default, 2px) solid var(--border);
}

.cpub-crop-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
}

.cpub-crop-x {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
  line-height: 1;
}
.cpub-crop-x:hover { color: var(--text); }
.cpub-crop-x:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cpub-crop-stage {
  position: relative;
  background: var(--surface2, var(--color-surface));
  height: 340px;
  overflow: hidden;
}

.cpub-cropper {
  height: 100%;
  width: 100%;
  background: transparent;
}

/* Circular hint for avatars (the stored crop stays square). */
.cpub-crop-round-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cpub-crop-round-mask::after {
  content: '';
  height: 92%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: var(--border-width-default, 2px) dashed var(--accent);
}

/* Style vue-advanced-cropper internals to the design system. */
.cpub-cropper :deep(.vue-advanced-cropper__background),
.cpub-cropper :deep(.vue-advanced-cropper__foreground) {
  background: var(--color-surface-scrim, rgba(0, 0, 0, 0.55));
}
/* Belt-and-suspenders with handlers:{}/lines:{}: never show the resize chrome. */
.cpub-cropper :deep(.vue-line-wrapper),
.cpub-cropper :deep(.vue-handler-wrapper) {
  display: none;
}
/* One clean accent frame around the crop window (outline = no layout shift,
   no per-side border doubling). Verified via headless render: the crop window is
   `.vue-rectangle-stencil`. */
.cpub-cropper :deep(.vue-rectangle-stencil) {
  outline: var(--border-width-default, 2px) solid var(--accent);
  outline-offset: calc(-1 * var(--border-width-default, 2px));
}

.cpub-crop-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 4px;
}

.cpub-crop-zbtn {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: var(--border-width-default, 2px) solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
}
.cpub-crop-zbtn:hover { border-color: var(--accent); color: var(--accent); }
.cpub-crop-zbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cpub-crop-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  background: var(--border);
  cursor: pointer;
}
.cpub-crop-slider:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.cpub-crop-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 0;
  background: var(--accent);
  border: var(--border-width-default, 2px) solid var(--accent);
  cursor: pointer;
}
.cpub-crop-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent);
  border: var(--border-width-default, 2px) solid var(--accent);
  border-radius: 0;
  cursor: pointer;
}

.cpub-crop-hint {
  font-size: 0.6875rem;
  color: var(--text-faint);
  text-align: center;
  padding: 4px 16px 0;
}

.cpub-crop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px;
}

@media (max-width: 560px) {
  .cpub-crop-stage { height: 280px; }
}
</style>
