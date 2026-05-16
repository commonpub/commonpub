/**
 * Lazy-load image resolution for content import.
 *
 * Modern sites (Hackster, Medium, most CMSes) lazy-load images:
 *
 *   <img src="data:image/gif;base64,…1x1placeholder"
 *        data-src="https://cdn/real.jpg"
 *        data-srcset="https://cdn/real-640.jpg 640w, …1280w">
 *
 * Turndown only reads `src`, so without this the importer emits
 * `![](data:…)` (or empty) and every in-article image is broken.
 *
 * `resolveContentImages` walks every <img> in a parsed document and
 * rewrites `src` to the best real URL it can find, absolutized against
 * the page URL, stripping the lazy attributes so the HTML→markdown
 * step picks up the real image. Mutates the document in place; safe to
 * call before Readability / innerHTML extraction.
 *
 * Conservative: if no real URL can be determined, the <img> is left
 * untouched (better a possibly-bad src than dropping the node).
 */

/** Common attributes lazy-load libraries stash the real URL in. */
const LAZY_SRC_ATTRS = [
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-lazy',
  'data-url',
  'data-hi-res-src',
  'data-full-src',
] as const;

const LAZY_SRCSET_ATTRS = ['data-srcset', 'data-lazy-srcset'] as const;

/** A `src` that isn't a real image — inline placeholder, blank, spacer. */
function isPlaceholderSrc(src: string | null | undefined): boolean {
  if (!src) return true;
  const s = src.trim();
  if (s === '') return true;
  if (s.startsWith('data:')) return true; // inline base64 placeholder
  if (s.startsWith('about:')) return true;
  // 1x1 / spacer gif conventions
  if (/(?:^|\/)(?:blank|spacer|placeholder|transparent|pixel)\.(?:gif|png)(?:$|\?)/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Pick the highest-resolution URL from a srcset string.
 * `"a.jpg 320w, b.jpg 640w, c.jpg 1280w"` → `c.jpg`.
 * Falls back to the last entry when there are no width/density
 * descriptors.
 */
function bestFromSrcset(srcset: string): string | null {
  const candidates = srcset
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/, 2);
      let weight = 0;
      if (descriptor) {
        const w = descriptor.match(/^(\d+(?:\.\d+)?)w$/);
        const x = descriptor.match(/^(\d+(?:\.\d+)?)x$/);
        if (w) weight = parseFloat(w[1]!);
        else if (x) weight = parseFloat(x[1]!) * 1000; // density: prefer over small widths
      }
      return { url, weight };
    })
    .filter((c) => !!c.url);

  if (candidates.length === 0) return null;
  // Highest descriptor wins; ties / no-descriptor → last listed (usually largest).
  let best = candidates[0]!;
  for (const c of candidates) {
    if (c.weight >= best.weight) best = c;
  }
  return best.url ?? null;
}

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * Resolve lazy-loaded <img> elements in `doc` to their real `src`,
 * absolutized against `baseUrl`. Mutates in place.
 *
 * Returns the number of <img> elements whose `src` was rewritten
 * (useful for tests / diagnostics).
 */
export function resolveContentImages(
  doc: { querySelectorAll(sel: string): ArrayLike<unknown> },
  baseUrl: string,
): number {
  const imgs = Array.from(doc.querySelectorAll('img')) as Array<{
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  }>;

  let rewritten = 0;

  for (const img of imgs) {
    const currentSrc = img.getAttribute('src');

    // 1. Explicit lazy single-URL attributes win first.
    let resolved: string | null = null;
    for (const attr of LAZY_SRC_ATTRS) {
      const v = img.getAttribute(attr);
      if (v && !isPlaceholderSrc(v)) {
        resolved = v;
        break;
      }
    }

    // 2. Lazy srcset variants.
    if (!resolved) {
      for (const attr of LAZY_SRCSET_ATTRS) {
        const v = img.getAttribute(attr);
        if (v) {
          const pick = bestFromSrcset(v);
          if (pick && !isPlaceholderSrc(pick)) {
            resolved = pick;
            break;
          }
        }
      }
    }

    // 3. A real (non-placeholder) plain srcset.
    if (!resolved) {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const pick = bestFromSrcset(srcset);
        if (pick && !isPlaceholderSrc(pick)) resolved = pick;
      }
    }

    // 4. The existing src, only if it's not a placeholder.
    if (!resolved && !isPlaceholderSrc(currentSrc)) {
      resolved = currentSrc!;
    }

    if (!resolved) continue; // nothing usable — leave the node as-is

    const absolute = absolutize(resolved, baseUrl);
    if (absolute !== currentSrc) {
      img.setAttribute('src', absolute);
      rewritten++;
    }
    // Drop lazy attrs so downstream HTML→markdown doesn't re-read a
    // placeholder or duplicate the image.
    for (const attr of [...LAZY_SRC_ATTRS, ...LAZY_SRCSET_ATTRS, 'srcset']) {
      img.removeAttribute(attr);
    }
  }

  return rewritten;
}
