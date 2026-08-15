/**
 * GET /api/public/v1/metrics/persona/fields
 *
 * Scope: `read:audience`. The countable fields on THIS instance, so a caller can
 * discover the cohorts before asking for one (plan 7.1, 7.4). This is schema
 * metadata, not member data: it describes the questions, never the answers.
 *
 * It is deliberately the per-instance surface. The published OpenAPI document
 * stays static and identical everywhere; an operator who adds a section shows up
 * here, which is exactly what this endpoint is for.
 *
 * Gating, in the order the route applies it:
 * - `requireFeature('persona')` and `requireFeature('personaAnalytics')` throw
 *   404, not 403, so a non-participating instance does not reveal the surface
 *   exists (the `/metrics/federation` double-gate precedent);
 * - `read:audience` is WILDCARD PROTECTED, so a key holding `read:*` is refused.
 *   Keys already in the field were issued for content metrics and must not
 *   silently pick up member cohort data.
 *
 * `truncated` and `total` are returned because a `limit` that silently cuts a
 * 30-field template to 20 is a false statement about the instance. Both count
 * FIELDS, never people.
 */
import { latestFinalisedSnapshot } from '@commonpub/server';

// Relative, not auto-imported: Nitro routes do not auto-import from `utils/`.
import { personaMetricsContext } from '../../../../../utils/personaMetricsContext';
import { z } from 'zod';


const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PublicPersonaFieldDescriptor {
  sectionKey: string;
  sectionLabel: string;
  fieldKey: string;
  fieldLabel: string;
  multiValued: boolean;
  options: Array<{ value: string; label: string }>;
}

export interface PublicPersonaFieldsResponse {
  items: PublicPersonaFieldDescriptor[];
  limit: number;
  /** Countable FIELDS on this instance, before `limit`. Never a person count. */
  total: number;
  truncated: boolean;
  /** Published counts on the sibling endpoints are floored to a multiple of this. */
  quantum: number;
  /** The finalised UTC day the sibling endpoints would serve, or null. */
  asOf: string | null;
}

export default defineEventHandler(async (event): Promise<PublicPersonaFieldsResponse> => {
  requireFeature('persona');
  requireFeature('personaAnalytics');
  // Every count here is a count of purpose GRANTS, and `dataSharingConsents`
  // governs the surface where those are given and withdrawn. The counting must
  // not outlive the surface: see `server/plugins/persona-rollup.ts`.
  requireFeature('dataSharingConsents');
  requireApiScope(event, 'read:audience');

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: parsed.error.flatten(),
    });
  }

  const db = useDB();
  const config = useConfig();

  // `fields` is already the intersection of the allow-list (sensitive, retired
  // and drifted keys dropped) and the cardinality map, so a field discoverable
  // here is exactly a field readable on /distribution and writable by the
  // rollup. See `personaMetricsContext`.
  const [{ sections, fields, thresholds }, snapshot] = await Promise.all([
    personaMetricsContext(db, config),
    latestFinalisedSnapshot(db),
  ]);

  const sectionLabels = new Map(sections.map((section) => [section.key, section.label]));
  const items: PublicPersonaFieldDescriptor[] = fields.map((field) => ({
    sectionKey: field.sectionKey,
    // The key is the fallback, never a blank: a section whose label went
    // missing should still be identifiable by a caller building a UI from this.
    sectionLabel: sectionLabels.get(field.sectionKey) ?? field.sectionKey,
    fieldKey: field.fieldKey,
    fieldLabel: field.label,
    multiValued: field.cardinality === 'set',
    options: [...field.options],
  }));

  return {
    items: items.slice(0, parsed.data.limit),
    limit: parsed.data.limit,
    total: items.length,
    truncated: items.length > parsed.data.limit,
    quantum: thresholds.minBucket,
    asOf: snapshot === null ? null : snapshot.day,
  };
});
