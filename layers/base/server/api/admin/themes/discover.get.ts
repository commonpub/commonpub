/**
 * GET /api/admin/themes/discover
 *
 * Returns the canonical default values for every known token. The client
 * uses this to diff against `getComputedStyle(:root)` and surface a
 * "your site has a custom theme — capture it?" CTA when the runtime values
 * differ from the built-in defaults.
 *
 * This is purely advisory; the client makes the decision based on the diff.
 */
import { TOKEN_SPECS } from '@commonpub/ui';

export default defineEventHandler((event) => {
  requireFeature('admin');
  requireAdmin(event);

  const defaults: Record<string, string> = {};
  for (const spec of TOKEN_SPECS) {
    defaults[spec.key] = spec.default;
  }
  return { defaults };
});
