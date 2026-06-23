/**
 * Helpers for contest content blocks (criteria-bar segment math, the shared
 * theme-color palette) + the inject key the contest editor uses to feed the
 * criteria-bar block its rubric. The math is pure/unit-testable in isolation.
 */
import type { InjectionKey, Ref } from 'vue';

/** A contest judging-rubric criterion (mirrors useContestEditor's criteria row). */
export interface ContestRubricCriterion { label: string; weight?: number; description?: string }

/** ContestEditor `provide`s its live judging criteria under this key so the
 *  criteria-bar edit block can offer a "use this contest's rubric" auto-fill.
 *  Absent (null) when the block is used outside the contest editor. */
export const CONTEST_RUBRIC_KEY: InjectionKey<Ref<ContestRubricCriterion[]>> = Symbol('contestRubric');

/** Theme color tokens segments cycle through (all dark/light-safe `var(--*)`). */
export const CRITERIA_BAR_PALETTE = ['accent', 'teal', 'green', 'yellow', 'purple', 'pink', 'red'] as const;
export type CriteriaColorKey = (typeof CRITERIA_BAR_PALETTE)[number];

/** Resolve a segment color: the author's palette key, else a rotation by index.
 *  Always a theme `var(--*)` so it adapts to light/dark + custom themes. */
export function criteriaColorVar(key: string | undefined, index = 0): string {
  const k = key && (CRITERIA_BAR_PALETTE as readonly string[]).includes(key)
    ? key
    : CRITERIA_BAR_PALETTE[index % CRITERIA_BAR_PALETTE.length];
  return `var(--${k})`;
}

export interface CriteriaBarItem { label: string; weight: number; color?: string }
export interface CriteriaSegment { label: string; weight: number; pct: number; colorVar: string; colorKey: string }

/**
 * Turn raw criteria items into proportional segments. Drops blank-label or
 * non-positive-weight rows; `pct` is each weight as a share of the total (so the
 * bar always fills 100% regardless of whether weights sum to 100).
 */
export function criteriaSegments(items: CriteriaBarItem[] | undefined): { segments: CriteriaSegment[]; total: number } {
  const valid = (items ?? []).filter((i) => (i?.label ?? '').trim() && Number(i?.weight) > 0);
  const total = valid.reduce((s, i) => s + Number(i.weight), 0);
  const segments = valid.map((i, idx) => {
    const key = i.color && (CRITERIA_BAR_PALETTE as readonly string[]).includes(i.color)
      ? i.color
      : CRITERIA_BAR_PALETTE[idx % CRITERIA_BAR_PALETTE.length]!;
    return {
      label: i.label.trim(),
      weight: Number(i.weight),
      pct: total > 0 ? Math.round((Number(i.weight) / total) * 1000) / 10 : 0,
      colorVar: `var(--${key})`,
      colorKey: key,
    };
  });
  return { segments, total };
}
