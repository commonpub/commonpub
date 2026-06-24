import type { CSSProperties } from 'vue';
import type { ContestImageMeta } from '@commonpub/schema';

/**
 * Map a contest banner/cover `ContestImageMeta` to CSS for the <img> (P4). The
 * framing is NON-DESTRUCTIVE — the original upload is never re-cropped; this only
 * drives object-fit / transform / object-position. Shared by ContestHero (public
 * render), the editor preview, and ContestBannerAdjust so all three agree.
 *
 *  - `null`/absent ⇒ `cover` with NO transform — the legacy fit, so existing
 *    contests look identical until an organiser touches the framing (back-compat).
 *  - `zoom <= 0`   ⇒ `contain` — perfect fit, the whole image visible (letterboxed).
 *  - `zoom > 0`    ⇒ `cover` + `scale(1 + zoom)` + `object-position: x% y%`.
 */
/** A `:style` object (a Vue CSSProperties subset) for an <img>. */
export type ImageFraming = CSSProperties;

export function imageFramingStyle(meta: ContestImageMeta | null | undefined): CSSProperties {
  if (!meta) return { objectFit: 'cover' };
  const x = clampPct(meta.x);
  const y = clampPct(meta.y);
  if (meta.zoom <= 0) return { objectFit: 'contain', objectPosition: `${x}% ${y}%` };
  const zoom = Math.min(4, meta.zoom);
  return { objectFit: 'cover', transform: `scale(${1 + zoom})`, objectPosition: `${x}% ${y}%` };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** The default framing an organiser starts from when they first adjust an image. */
export function defaultImageMeta(): ContestImageMeta {
  return { zoom: 0, x: 50, y: 50 };
}

/**
 * True when the framing means "show the WHOLE image" (Fit, zoom 0). Surfaces that
 * can grow (the hero banner band, the editor preview) render this as a natural-ratio
 * image (no crop, no letterbox bars) rather than `contain` inside a fixed band.
 * null/absent = the legacy cover fit, so this is false (existing banners unchanged).
 */
export function isWholeImage(meta: ContestImageMeta | null | undefined): boolean {
  return !!meta && meta.zoom <= 0;
}
