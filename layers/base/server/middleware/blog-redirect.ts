/**
 * Server middleware: redirect article URLs to blog URLs.
 * - /u/{username}/article/{slug} → /u/{username}/blog/{slug}
 * - /u/{username}/article/{slug}/edit → /u/{username}/blog/{slug}/edit
 * - /article → /blog (listing page)
 *
 * Article content type has been merged into blog. These 301 redirects
 * ensure old URLs and bookmarks continue working.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;

  // Redirect /article listing to /blog
  if (path === '/article' || path === '/article/') {
    const query = getRequestURL(event).search;
    return sendRedirect(event, `/blog${query}`, 301);
  }

  // Redirect /u/{username}/article/{slug}[/edit] to /u/{username}/blog/{slug}[/edit]
  const match = path.match(/^\/u\/([^/]+)\/article\/(.+)$/);
  if (!match) return;

  const newPath = `/u/${match[1]}/blog/${match[2]}`;
  const query = getRequestURL(event).search;
  return sendRedirect(event, `${newPath}${query}`, 301);
});
