/**
 * What analytics is allowed to know about a route.
 *
 * Extracted from `plugins/analytics.client.ts` so both rules can be tested
 * directly. Inside the plugin they were only reachable through a real router in
 * a real browser, and the e2e that appeared to cover the private-route rule
 * actually exercised only the prefix backstop: logged out, `/settings/profile`
 * redirects to `/auth/login`, and `/auth` is in the list. The derived
 * middleware check, which is the part that covers new pages automatically, had
 * no coverage at all.
 */

/**
 * The shape both rules need. Deliberately not vue-router's type, so these can
 * be tested with plain objects.
 *
 * `middleware` is `unknown` because Nuxt types it as
 * `MiddlewareKey | NavigationGuard | (MiddlewareKey | NavigationGuard)[]`: it
 * can be an inline FUNCTION, not only a named key. A function guard cannot be
 * recognised by name, so a page that protects itself that way is not covered by
 * the derived check and falls to the NEVER_MEASURED backstop. That is a reason
 * the backstop exists, and a reason not to delete it.
 */
export interface AnalyticsRoute {
  path: string;
  meta?: { middleware?: unknown } & Record<string, unknown>;
}

/**
 * Areas that must never be measured even if a page there forgets to declare the
 * auth middleware. The middleware check is the PRIMARY signal and is derived,
 * so it covers new pages by itself; this is a backstop for the case where that
 * signal is absent. Leaking a private path or title to a third-party processor
 * is not a failure worth being elegant about.
 */
export const NEVER_MEASURED = [
  '/settings',
  '/messages',
  '/admin',
  '/dashboard',
  '/notifications',
  '/auth',
] as const;

/** True when the route is behind a login, so nothing about it may be reported. */
export function isPrivateRoute(route: AnalyticsRoute): boolean {
  const mw = route.meta?.middleware;
  if (mw === 'auth') return true;
  if (Array.isArray(mw) && mw.some((m) => m === 'auth')) return true;
  return NEVER_MEASURED.some((p) => route.path === p || route.path.startsWith(`${p}/`));
}

/**
 * The address of a page with everything the visitor typed removed.
 *
 * Query and fragment both go: `?q=`, `?email=`, `?token=` and `#section` are
 * either user input or a credential, and none of them are worth a pageview
 * dimension. A live check in session 254 found `/search?q=my+secret+search+term`
 * reaching the processor in the `dl` parameter of a `view_search_results` hit,
 * while the privacy page promised that nothing typed into a form is collected.
 */
export function publicPath(route: AnalyticsRoute): string {
  return route.path;
}
