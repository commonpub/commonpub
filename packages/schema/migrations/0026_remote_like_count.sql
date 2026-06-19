ALTER TABLE "content_items" ADD COLUMN "remote_like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_posts" ADD COLUMN "remote_like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill the remote (federated) like portion from current drift so reconcile-counters
-- (which computes like_count = local likes + remote_like_count) does NOT wipe existing
-- fediverse likes on its first run. remote = max(0, stored like_count - local likes rows).
-- Audit session 203. Idempotent on re-run (difference is 0 once remote_like_count is set).
UPDATE "content_items" t SET "remote_like_count" = GREATEST(0, t."like_count" - (
  SELECT count(*)::int FROM "likes" l
  WHERE l."target_id" = t."id" AND l."target_type" IN ('project','article','blog','explainer')
)) WHERE t."remote_like_count" = 0;--> statement-breakpoint
UPDATE "hub_posts" t SET "remote_like_count" = GREATEST(0, t."like_count" - (
  SELECT count(*)::int FROM "hub_post_likes" l WHERE l."post_id" = t."id"
)) WHERE t."remote_like_count" = 0;
