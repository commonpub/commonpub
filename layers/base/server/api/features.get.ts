/**
 * GET /api/features
 * Returns the current merged feature flags (build-time + env + DB overrides).
 * Public endpoint — used by client-side useFeatures() for runtime reactivity.
 */
export default defineEventHandler(() => {
  const config = useConfig();
  return config.features;
});
