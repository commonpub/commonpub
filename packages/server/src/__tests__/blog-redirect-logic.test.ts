/**
 * Unit tests for blog redirect URL transformation logic.
 * Tests the regex patterns and URL rewriting used by blog-redirect.ts middleware.
 *
 * The actual middleware depends on Nitro runtime (defineEventHandler, sendRedirect),
 * so we test the pure transformation logic here.
 */
import { describe, it, expect } from 'vitest';

// Extracted logic from layers/base/server/middleware/blog-redirect.ts
function getRedirectTarget(pathname: string): string | null {
  // /article listing → /blog
  if (pathname === '/article' || pathname === '/article/') {
    return '/blog';
  }

  // /u/{username}/article/{slug}[/edit] → /u/{username}/blog/{slug}[/edit]
  const match = pathname.match(/^\/u\/([^/]+)\/article\/(.+)$/);
  if (!match) return null;

  return `/u/${match[1]}/blog/${match[2]}`;
}

describe('blog redirect URL transformation', () => {
  describe('/article listing redirects', () => {
    it('redirects /article to /blog', () => {
      expect(getRedirectTarget('/article')).toBe('/blog');
    });

    it('redirects /article/ to /blog', () => {
      expect(getRedirectTarget('/article/')).toBe('/blog');
    });

    it('does not redirect /articles (plural)', () => {
      expect(getRedirectTarget('/articles')).toBeNull();
    });
  });

  describe('/u/{username}/article/{slug} redirects', () => {
    it('redirects content view URL', () => {
      expect(getRedirectTarget('/u/alice/article/my-post')).toBe('/u/alice/blog/my-post');
    });

    it('redirects content edit URL', () => {
      expect(getRedirectTarget('/u/alice/article/my-post/edit')).toBe('/u/alice/blog/my-post/edit');
    });

    it('handles usernames with hyphens and underscores', () => {
      expect(getRedirectTarget('/u/dev-alice_42/article/test')).toBe('/u/dev-alice_42/blog/test');
    });

    it('handles slugs with multiple segments', () => {
      expect(getRedirectTarget('/u/bob/article/my-long-slug-here')).toBe('/u/bob/blog/my-long-slug-here');
    });

    it('redirects new content creation URL', () => {
      expect(getRedirectTarget('/u/alice/article/new/edit')).toBe('/u/alice/blog/new/edit');
    });
  });

  describe('non-matching paths pass through', () => {
    it('does not redirect /u/{user}/blog/{slug}', () => {
      expect(getRedirectTarget('/u/alice/blog/my-post')).toBeNull();
    });

    it('does not redirect /u/{user}/project/{slug}', () => {
      expect(getRedirectTarget('/u/alice/project/my-build')).toBeNull();
    });

    it('does not redirect /u/{user}/explainer/{slug}', () => {
      expect(getRedirectTarget('/u/alice/explainer/how-it-works')).toBeNull();
    });

    it('does not redirect root path', () => {
      expect(getRedirectTarget('/')).toBeNull();
    });

    it('does not redirect /blog', () => {
      expect(getRedirectTarget('/blog')).toBeNull();
    });

    it('does not redirect /blog/', () => {
      expect(getRedirectTarget('/blog/')).toBeNull();
    });

    it('does not redirect /create', () => {
      expect(getRedirectTarget('/create')).toBeNull();
    });

    it('does not redirect /api/content paths', () => {
      expect(getRedirectTarget('/api/content/article-id')).toBeNull();
    });
  });
});
