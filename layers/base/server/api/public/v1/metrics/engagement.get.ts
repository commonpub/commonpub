import { getEngagementMetrics } from '@commonpub/server';

/**
 * GET /api/public/v1/metrics/engagement
 *
 * Scope: read:analytics. Aggregate engagement ratios and funnels: content
 * likes/comments-per-view, learning enroll->complete, event capacity->attendance,
 * contest entries. Feature-gated sections are omitted when the feature is off.
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const db = useDB();
  const config = useConfig();
  return await getEngagementMetrics(db, {
    learning: config.features.learning,
    events: config.features.events,
    contests: config.features.contests,
  });
});
