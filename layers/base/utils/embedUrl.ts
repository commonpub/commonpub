/**
 * Translate a pasted video / embed URL into an iframe-embeddable form.
 *
 * Authors commonly paste the watch-page URL (which provider iframes
 * refuse to render via X-Frame-Options). This helper detects YouTube
 * and Vimeo URLs and rewrites them to the canonical embed form,
 * preserving start-time (`?t=`) and Vimeo private-video hashes.
 *
 * Unknown providers pass through unchanged if they use http(s),
 * otherwise return empty string (blocks `javascript:`, `data:` etc).
 *
 * Returns `''` when the input is empty or rejected.
 */
export function toEmbedUrl(raw: string | null | undefined): string {
  if (!raw) return '';

  // YouTube — watch / embed / v / shorts / youtu.be. The capture group is
  // the 11-char video ID; we accept 6+ to tolerate future ID-length shifts.
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
  );
  if (yt) {
    const id = yt[1];
    const start = extractStartSeconds(raw);
    return start > 0
      ? `https://www.youtube-nocookie.com/embed/${id}?start=${start}`
      : `https://www.youtube-nocookie.com/embed/${id}`;
  }

  // Vimeo — public (vimeo.com/ID) and private (vimeo.com/ID/HASH). The
  // hash is required for unlisted/private videos; without it the iframe
  // 403s.
  const vimeo = raw.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (vimeo) {
    const id = vimeo[1];
    const hash = vimeo[2];
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
  }

  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
  return '';
}

/**
 * Extract a `t=` / `start=` query parameter from a URL and convert it
 * to integer seconds. Supports YouTube's mixed formats:
 *   - 120
 *   - 120s
 *   - 2m30s
 *   - 1h30m45s
 * Returns 0 if no start-time is present or the format is unrecognized.
 */
export function extractStartSeconds(raw: string): number {
  const m = raw.match(/[?&#](?:t|start)=([^&#]+)/);
  if (!m) return 0;
  const t = m[1];
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const parts = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!parts) return 0;
  const h = parseInt(parts[1] || '0', 10);
  const mm = parseInt(parts[2] || '0', 10);
  const s = parseInt(parts[3] || '0', 10);
  return h * 3600 + mm * 60 + s;
}
