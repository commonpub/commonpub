/**
 * Helpers for contest content blocks (criteria-bar segment math, the shared
 * theme-color palette) + the inject key the contest editor uses to feed the
 * criteria-bar block its rubric. The math is pure/unit-testable in isolation.
 */
import type { InjectionKey, Ref } from 'vue';
import type { RoadmapItem } from '../types/contestBlocks';

/** A contest judging-rubric criterion (mirrors useContestEditor's criteria row). */
export interface ContestRubricCriterion { label: string; weight?: number; description?: string }

/** ContestEditor `provide`s its live judging criteria under this key so the
 *  criteria-bar edit block can offer a "use this contest's rubric" auto-fill.
 *  Absent (null) when the block is used outside the contest editor. */
export const CONTEST_RUBRIC_KEY: InjectionKey<Ref<ContestRubricCriterion[]>> = Symbol('contestRubric');

/** ContestEditor `provide`s a ready-to-use roadmap derived from the contest's
 *  effective schedule under this key, so the roadmap block can offer a
 *  "pull from schedule" seed. Absent (null) outside the contest editor. */
export const CONTEST_SCHEDULE_KEY: InjectionKey<Ref<RoadmapItem[]>> = Symbol('contestSchedule');

/** A stage as the roadmap cares about it (structural subset of ContestStage). */
export interface RoadmapStageSource { name: string; kind?: string; startsAt?: string; endsAt?: string; description?: string }
/** The three core schedule dates, when there are no custom stages. */
export interface RoadmapScheduleDates { startDate?: string; endDate?: string; judgingEndDate?: string }

/** Format an ISO date as a short label ("Jun 30"); '' for empty/invalid input. */
export function fmtRoadmapDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Derive roadmap items from the contest's effective timeline: the custom stages
 * when present, else the core Submissions → Judging → Results flow from the
 * schedule dates. The `results` kind (and the synthetic finale) get the
 * `highlight` tone. Pure — the seed the roadmap edit block copies in.
 */
export function roadmapFromSchedule(stages: RoadmapStageSource[] | undefined, schedule: RoadmapScheduleDates): RoadmapItem[] {
  const named = (stages ?? []).filter((s) => (s?.name ?? '').trim());
  if (named.length) {
    return named.map((s) => ({
      date: fmtRoadmapDate(s.startsAt ?? s.endsAt),
      title: s.name.trim(),
      description: (s.description ?? '').trim() || undefined,
      tone: s.kind === 'results' ? 'highlight' : 'default',
    }));
  }
  const items: RoadmapItem[] = [];
  if (schedule.startDate) items.push({ date: fmtRoadmapDate(schedule.startDate), title: 'Submissions open', tone: 'default' });
  if (schedule.endDate) items.push({ date: fmtRoadmapDate(schedule.endDate), title: 'Submissions close', tone: 'default' });
  const judge = schedule.judgingEndDate || schedule.endDate;
  if (judge) items.push({ date: fmtRoadmapDate(judge), title: 'Judging ends', tone: 'default' });
  items.push({ title: 'Results announced', tone: 'highlight' });
  return items;
}

/**
 * Theme color tokens segments cycle through (all dark/light-safe `var(--*)`).
 * Ordered to spread hue across the rotation so adjacent segments stay
 * distinguishable in a seamless (gap-free) bar — incl. green-accent themes where
 * accent/teal/green collapse, so those three are kept apart in the order.
 */
export const CRITERIA_BAR_PALETTE = ['accent', 'yellow', 'purple', 'teal', 'pink', 'green', 'red'] as const;
export type CriteriaColorKey = (typeof CRITERIA_BAR_PALETTE)[number];

/** Resolve a segment color: the author's palette key, else a rotation by index.
 *  Always a theme `var(--*)` so it adapts to light/dark + custom themes. */
export function criteriaColorVar(key: string | undefined, index = 0): string {
  const k = key && (CRITERIA_BAR_PALETTE as readonly string[]).includes(key)
    ? key
    : CRITERIA_BAR_PALETTE[index % CRITERIA_BAR_PALETTE.length];
  return `var(--${k})`;
}

export interface CriteriaBarItem { label: string; weight?: number; color?: string; description?: string }
export interface CriteriaRow { label: string; weight: number; description?: string; pct: number; colorVar: string; colorKey: string }

/**
 * Resolve criteria items into legend rows + bar geometry. EVERY labeled item
 * becomes a row (so the legend lists them all, even 0-weight/holistic ones);
 * `pct` is each weight's share of the total (the bar fills 100% regardless of
 * whether weights sum to 100). Colors are assigned by the item's index in the
 * labeled list so a row's legend swatch always matches its bar segment. The bar
 * renders `rows.filter(r => r.pct > 0)`.
 */
export function criteriaBar(items: CriteriaBarItem[] | undefined): { rows: CriteriaRow[]; total: number } {
  const labeled = (items ?? []).filter((i) => (i?.label ?? '').trim());
  const total = labeled.reduce((s, i) => s + Math.max(0, Number(i?.weight) || 0), 0);
  const rows = labeled.map((i, idx) => {
    const key = i.color && (CRITERIA_BAR_PALETTE as readonly string[]).includes(i.color)
      ? i.color
      : CRITERIA_BAR_PALETTE[idx % CRITERIA_BAR_PALETTE.length]!;
    const w = Math.max(0, Number(i.weight) || 0);
    return {
      label: i.label.trim(),
      weight: w,
      description: (i.description ?? '').trim() || undefined,
      pct: total > 0 ? Math.round((w / total) * 1000) / 10 : 0,
      colorVar: `var(--${key})`,
      colorKey: key,
    };
  });
  return { rows, total };
}
