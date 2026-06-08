/**
 * Font catalog + Google Fonts helpers. The catalog is grouped for the
 * picker UI; the helper functions build CSS font stacks and the Google
 * Fonts stylesheet URL for a chosen set. Ported from GAUGE.
 */

/** Grouped font catalog (group label → family names). */
export const FONTS: Record<string, string[]> = {
  Sans: [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'Source Sans 3', 'Montserrat',
    'Poppins', 'Raleway', 'Nunito', 'Nunito Sans', 'Mulish', 'Karla', 'Barlow',
    'Barlow Condensed', 'Manrope', 'Sora', 'Outfit', 'Lexend', 'Plus Jakarta Sans',
    'DM Sans', 'Figtree', 'Hanken Grotesk', 'Albert Sans', 'Schibsted Grotesk', 'Onest',
    'Archivo', 'Archivo Narrow', 'Syne', 'Bricolage Grotesque', 'Space Grotesk', 'Proza Libre',
  ],
  'Display Sans': [
    'Fredoka', 'Quicksand', 'Baloo 2', 'Oswald', 'Archivo Black', 'Anton', 'Bebas Neue',
    'Unbounded', 'Big Shoulders Display', 'Bungee',
  ],
  Serif: [
    'Playfair Display', 'Cormorant Garamond', 'Cormorant', 'EB Garamond', 'Lora', 'Vollkorn',
    'Bitter', 'Spectral', 'Crimson Pro', 'Libre Baskerville', 'Source Serif 4', 'Merriweather',
    'Newsreader', 'DM Serif Display', 'Fraunces', 'Abril Fatface', 'Yeseva One', 'Marcellus',
    'Instrument Serif', 'Bodoni Moda',
  ],
  Mono: [
    'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'DM Mono', 'Roboto Mono', 'Fira Code',
    'Source Code Pro', 'Inconsolata', 'Overpass Mono', 'Martian Mono', 'Courier Prime',
  ],
  'Hand & Pixel': [
    'VT323', 'Major Mono Display', 'DotGothic16', 'Pixelify Sans', 'Silkscreen', 'Press Start 2P',
    'Permanent Marker', 'Caveat', 'Shadows Into Light', 'Special Elite', 'Monoton', 'Rampart One',
  ],
};

/** Flat list of every catalog family. */
export const ALL_FONTS: string[] = Object.values(FONTS).flat();

/** Families that ship only a single weight (no `wght@` axis on the URL). */
export const SINGLE_WEIGHT: Set<string> = new Set([
  'Anton', 'Bebas Neue', 'Abril Fatface', 'Yeseva One', 'Marcellus', 'Instrument Serif', 'VT323',
  'Major Mono Display', 'DotGothic16', 'Press Start 2P', 'Permanent Marker', 'Shadows Into Light',
  'Special Elite', 'Monoton', 'Rampart One', 'Bungee', 'Archivo Black', 'DM Serif Display',
]);

/** Families that should fall back to monospace. */
export const MONO_FAMILIES: Set<string> = new Set([
  ...FONTS['Mono']!, 'VT323', 'Major Mono Display', 'Press Start 2P', 'Silkscreen', 'Martian Mono',
]);

/** Families that should fall back to serif. */
export const SERIF_FAMILIES: Set<string> = new Set(FONTS['Serif']!);

/** System fallback stack for a family, by category. */
export function fallbackFor(fam: string): string {
  if (MONO_FAMILIES.has(fam)) return 'ui-monospace, monospace';
  if (SERIF_FAMILIES.has(fam)) return 'Georgia, serif';
  return 'system-ui, sans-serif';
}

/** Full CSS `font-family` stack for a family. */
export function fontStack(fam: string): string {
  return "'" + fam + "', " + fallbackFor(fam);
}

/** Family + its fallbacks as an array (for Tailwind-style configs). */
export function fontArr(fam: string): string[] {
  return [fam, ...fallbackFor(fam).split(',').map((s) => s.trim())];
}

/**
 * Build a Google Fonts CSS2 stylesheet URL for a set of families. Empty
 * input yields an empty string. Single-weight families omit the `wght`
 * axis. The returned URL only ever references `fonts.googleapis.com`.
 *
 * Family names are URL-encoded (spaces → `+`, everything else percent-
 * encoded) so a tampered/imported family string can't inject extra query
 * params (`&family=`, `&display=`) into the request.
 */
export function googleHref(fams: string[]): string {
  const unique = fams.filter((f, i, a) => f && a.indexOf(f) === i);
  if (unique.length === 0) return '';
  const parts = unique.map((f) => {
    const q = encodeURIComponent(f).replace(/%20/g, '+');
    return 'family=' + q + (SINGLE_WEIGHT.has(f) ? '' : ':wght@400;700');
  });
  return 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap';
}
