export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl as string;

  const content = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/
Disallow: /messages/
Disallow: /create/

Sitemap: ${siteUrl}/sitemap.xml
`;

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400');
  return content;
});
