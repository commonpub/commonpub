-- Data-integrity constraints that have been implicit in app code forever.
-- Ship them at the DB level so the guarantee survives a buggy commit.
--
-- 1. federated_content.mirror_id → instance_mirrors.id (ON DELETE SET NULL)
-- 2. UNIQUE (event_id, user_id) on event_attendees

-- Null out any orphan mirror_id references before the FK is applied.
-- commonpub.io has 3 such rows today (session 108+ mirror config deletions
-- didn't cascade-null these — which is exactly the bug this FK prevents).
-- Deveco.io has 0 orphans. Safe no-op where clean.
UPDATE "federated_content"
  SET "mirror_id" = NULL
  WHERE "mirror_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "instance_mirrors" WHERE "instance_mirrors"."id" = "federated_content"."mirror_id"
    );
--> statement-breakpoint
ALTER TABLE "federated_content" ADD CONSTRAINT "federated_content_mirror_id_instance_mirrors_id_fk" FOREIGN KEY ("mirror_id") REFERENCES "public"."instance_mirrors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_user_unique" UNIQUE("event_id","user_id");
