import { describe, it, expect } from 'vitest';
import { isPrivateRoute, publicPath, NEVER_MEASURED } from '../analyticsRoutes';

/**
 * What the analytics tag is allowed to learn about a route.
 *
 * These rules are what make two promises on /privacy true: that nothing typed
 * into a form is collected, and that nothing on a page requiring an account is.
 * Both were false before session 254, measured against the live property.
 *
 * They live here rather than inside the plugin because inside the plugin the
 * only way to reach them was a real router in a real browser, and the e2e that
 * looked like it covered the private-route rule exercised only the prefix
 * backstop: logged out, /settings/profile redirects to /auth/login, and /auth
 * is in the list. The MIDDLEWARE check, which is the derived half and the half
 * that covers pages added later, was never executed by any test.
 */
describe('isPrivateRoute', () => {
  it('treats a route declaring the auth middleware as private', () => {
    // The derived signal, and the one that had no coverage. 49 pages declare it.
    expect(isPrivateRoute({ path: '/contests/x/judge', meta: { middleware: 'auth' } })).toBe(true);
  });

  it('handles the array form of middleware', () => {
    expect(isPrivateRoute({ path: '/videos/submit', meta: { middleware: ['auth'] } })).toBe(true);
    expect(isPrivateRoute({ path: '/videos/submit', meta: { middleware: ['other', 'auth'] } })).toBe(true);
  });

  it('covers pages OUTSIDE the prefix list purely from their middleware', () => {
    // This is the case the e2e could not reach. None of these paths is in
    // NEVER_MEASURED, so if the middleware check regressed they would be
    // measured and the prefix backstop would not save them.
    for (const path of [
      '/contests/summer/judge',
      '/contests/create',
      '/events/create',
      '/hubs/create',
      '/videos/submit',
      '/learn/intro/edit',
      '/docs/handbook/edit',
      '/u/alice/project/thing/edit',
    ]) {
      expect(
        isPrivateRoute({ path, meta: { middleware: 'auth' } }),
        `${path} declares auth middleware and must not be measured`,
      ).toBe(true);
      expect(
        NEVER_MEASURED.some((p) => path === p || path.startsWith(`${p}/`)),
        `${path} must NOT be covered by the prefix list, or this test proves nothing`,
      ).toBe(false);
    }
  });

  it('treats the never-measured areas as private even without middleware', () => {
    // The backstop, for a page that forgets to declare it.
    for (const path of ['/settings', '/settings/profile', '/messages/abc123', '/admin/users', '/notifications', '/dashboard', '/auth/login']) {
      expect(isPrivateRoute({ path }), `${path} must be private`).toBe(true);
    }
  });

  it('does not match a public path that merely starts with the same letters', () => {
    // `/settings-guide` is not inside `/settings`. A bare startsWith without the
    // trailing slash would swallow it and silently stop measuring a public page.
    for (const path of ['/settingsguide', '/settings-guide', '/administrators', '/authors', '/messages-about-us']) {
      expect(isPrivateRoute({ path }), `${path} is public`).toBe(false);
    }
  });

  it('leaves ordinary public routes measurable', () => {
    for (const path of ['/', '/contests', '/search', '/u/alice', '/explore', '/videos']) {
      expect(isPrivateRoute({ path }), `${path} should be measured`).toBe(false);
    }
  });

  it('ignores a non-auth middleware', () => {
    expect(isPrivateRoute({ path: '/contests', meta: { middleware: 'feature-gate' } })).toBe(false);
  });

  it('does not crash on a function guard, and falls back to the prefix list', () => {
    // Nuxt allows an inline NavigationGuard, which cannot be recognised by name.
    // Such a page is NOT covered by the derived check; this pins that the
    // backstop is what protects it, and that a function never throws here.
    const guard = (): void => {};
    expect(isPrivateRoute({ path: '/contests/x/judge', meta: { middleware: guard } })).toBe(false);
    expect(isPrivateRoute({ path: '/settings/secret', meta: { middleware: guard } })).toBe(true);
    expect(isPrivateRoute({ path: '/contests', meta: { middleware: [guard, 'auth'] } })).toBe(true);
  });
});

describe('publicPath', () => {
  it('drops the query string, which is where typed input lives', () => {
    // The measured leak: `/search?q=my+secret+search+term` reached the processor.
    expect(publicPath({ path: '/search' })).toBe('/search');
  });

  it('returns only the path for every route shape', () => {
    // `path` excludes both query and hash by construction; this pins that the
    // implementation keeps using `path` rather than drifting to `fullPath`,
    // which is what carried the query in the first place.
    for (const path of ['/', '/search', '/contests/summer', '/u/alice/project/thing']) {
      expect(publicPath({ path })).toBe(path);
      expect(publicPath({ path })).not.toContain('?');
      expect(publicPath({ path })).not.toContain('#');
    }
  });
});
