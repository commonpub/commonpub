-- Article→Blog Migration Script (manual fallback — normally runs automatically via server plugin)
--
-- The server plugin migrate-article-to-blog.ts handles this on startup.
-- This script is only needed if the plugin didn't run for some reason.

BEGIN;

-- Preserve "article" intent as category for rows without an existing category
UPDATE content_items SET category = 'article' WHERE type = 'article' AND category IS NULL;

-- Convert type
UPDATE content_items SET type = 'blog' WHERE type = 'article';

-- Verify
SELECT type, count(*) FROM content_items WHERE type IN ('blog', 'article') GROUP BY type;

COMMIT;
