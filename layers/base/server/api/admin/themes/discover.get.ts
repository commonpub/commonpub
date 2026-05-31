/**
 * GET /api/admin/themes/discover
 *
 * Returns the canonical default values for every known token.
 *
 * **CURRENTLY UNUSED** (as of session 157). The client-side
 * `detectAppliedOverrides()` in `utils/themeDiscovery.ts` uses
 * `TOKEN_SPECS` directly (same data source, no HTTP). The endpoint is
 * kept because:
 *   1. It's documented in `docs/reference/guides/theme-editor.md` as
 *      the source of truth for default values.
 *   2. A future Phase (section registry adds new tokens at runtime, or
 *      the layer wants to source defaults from the server rather than
 *      the client bundle) may flip the client to use this endpoint.
 *   3. Deleting would force a doc revision + breaking-change note for
 *      anyone who scripted against it externally.
 *
 * Cost is zero (no DB hit, just returns a static map). Safe to keep.
 */
import { TOKEN_SPECS } from '@commonpub/ui';

export default defineEventHandler((event) => {
  requireFeature('admin');
  requirePermission(event, 'theme.manage');

  const defaults: Record<string, string> = {};
  for (const spec of TOKEN_SPECS) {
    defaults[spec.key] = spec.default;
  }
  return { defaults };
});
