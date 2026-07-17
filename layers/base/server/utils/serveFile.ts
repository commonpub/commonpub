import type { H3Event } from 'h3';

// Neutralize SVGs served inline: they can embed <script> and would execute
// same-origin. This exact CSP string is security-load-bearing; keeping it in one
// place stops it drifting between file-serving routes.
const SVG_NEUTRALIZE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** Strip anything that could break out of a `Content-Disposition` filename. */
export function safeContentDispositionName(name: string | null | undefined): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 128);
  return cleaned || 'download';
}

/**
 * Set safe response headers for streaming a stored file's bytes. Centralizes the
 * security-relevant policy — `nosniff`, the SVG-neutralizing CSP, and an
 * inline-only-for-raster-images `Content-Disposition` (everything else downloads,
 * so nothing executes same-origin) — so it can't diverge across file-serving
 * routes. The caller owns `cache` (public-immutable vs private no-store) and the
 * MIME source, which legitimately differ per route.
 */
export function setStoredFileHeaders(
  event: H3Event,
  opts: { mime: string; filename?: string | null; contentLength?: number | null; cache: string },
): void {
  const mime = opts.mime || 'application/octet-stream';
  const inline = mime.startsWith('image/') && mime !== 'image/svg+xml';
  setResponseHeader(event, 'Content-Type', mime);
  if (opts.contentLength != null) setResponseHeader(event, 'Content-Length', opts.contentLength);
  setResponseHeader(event, 'Cache-Control', opts.cache);
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(
    event,
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${safeContentDispositionName(opts.filename)}"`,
  );
  if (mime === 'image/svg+xml') {
    setResponseHeader(event, 'Content-Security-Policy', SVG_NEUTRALIZE_CSP);
  }
}
