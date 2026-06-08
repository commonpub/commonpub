/**
 * Evocative color naming — turn a hex value into a material/pigment name
 * (`rust`, `cobalt`, `graphite`). Used to label swatches in the preview
 * sheet. Deterministic: a given hex always picks the same candidate first.
 * Ported from GAUGE.
 */
import { hexToHsl } from './color.js';

/** Stable FNV-1a hash for deterministic candidate selection. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ordered list of candidate names for a single hex, best-fit first. */
export function nameCandidates(hex: string): string[] {
  const c = hexToHsl(hex);
  const l = c.l;
  const s = c.s;
  const h = c.h;
  if (l < 11) return ['void', 'pitch', 'obsidian', 'onyx', 'soot', 'jet'];
  if (l < 20) return ['ink', 'char', 'tar', 'sable', 'graphite', 'umber'];
  if (l > 94) return ['paper', 'ivory', 'snow', 'cloud', 'porcelain'];
  if (l > 82) return ['bone', 'linen', 'oat', 'fog', 'mist', 'parchment', 'chalk'];
  if (s < 11) {
    if (l < 34) return ['graphite', 'slate', 'gunmetal', 'char', 'basalt'];
    if (l < 62) return ['concrete', 'ash', 'stone', 'cement', 'pewter'];
    return ['smoke', 'dust', 'silt', 'quartz'];
  }
  let w: string[];
  if (h < 14 || h >= 346) w = ['rust', 'ember', 'cinder', 'garnet', 'brick', 'crimson'];
  else if (h < 38) w = ['copper', 'terracotta', 'amber', 'clay', 'ochre', 'sienna'];
  else if (h < 66) w = ['brass', 'honey', 'mustard', 'flax', 'ochre', 'gold'];
  else if (h < 95) w = ['chartreuse', 'lime', 'citron', 'moss', 'olive'];
  else if (h < 158) w = ['moss', 'fern', 'sage', 'jade', 'pine', 'verdant'];
  else if (h < 200) w = ['patina', 'teal', 'lagoon', 'verdigris', 'spruce', 'cyan'];
  else if (h < 232) w = ['cobalt', 'azure', 'steel', 'slate-blue', 'cerulean'];
  else if (h < 262) w = ['indigo', 'cobalt', 'sapphire', 'ultramarine'];
  else if (h < 292) w = ['iris', 'amethyst', 'plum', 'violet', 'wisteria'];
  else w = ['fuchsia', 'magenta', 'rose', 'orchid', 'mulberry'];
  return w;
}

/** Assign each hex a unique evocative name (de-duplicating collisions). */
export function nameSwatches(hexes: string[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  hexes.forEach((hex) => {
    const cands = nameCandidates(hex);
    let pick: string | null = null;
    const start = hashStr(hex) % cands.length;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[(start + i) % cands.length]!;
      if (!used.has(c)) {
        pick = c;
        break;
      }
    }
    if (!pick) {
      let n = 2;
      pick = cands[start] + String(n);
      while (used.has(pick)) {
        n++;
        pick = cands[start] + String(n);
      }
    }
    used.add(pick);
    out.push(pick);
  });
  return out;
}
