-- Null out any dangling self-reference pointers (parent row already hard-deleted) BEFORE
-- adding the FK constraints, so ADD CONSTRAINT doesn't fail on pre-existing orphans.
-- (Same pattern as migration 0002 for federated_content.mirror_id.)
UPDATE "docs_pages" p SET "parent_id" = NULL WHERE p."parent_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "docs_pages" c WHERE c."id" = p."parent_id");--> statement-breakpoint
UPDATE "hub_post_replies" p SET "parent_id" = NULL WHERE p."parent_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "hub_post_replies" c WHERE c."id" = p."parent_id");--> statement-breakpoint
UPDATE "hubs" p SET "parent_hub_id" = NULL WHERE p."parent_hub_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "hubs" c WHERE c."id" = p."parent_hub_id");--> statement-breakpoint
UPDATE "comments" p SET "parent_id" = NULL WHERE p."parent_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "comments" c WHERE c."id" = p."parent_id");--> statement-breakpoint
ALTER TABLE "docs_pages" ADD CONSTRAINT "docs_pages_parent_id_docs_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_replies" ADD CONSTRAINT "hub_post_replies_parent_id_hub_post_replies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."hub_post_replies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_parent_hub_id_hubs_id_fk" FOREIGN KEY ("parent_hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;