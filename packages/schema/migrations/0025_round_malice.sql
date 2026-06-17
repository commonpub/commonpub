ALTER TABLE "contest_stakeholders" ADD COLUMN "role" varchar(32) DEFAULT 'reviewer' NOT NULL;--> statement-breakpoint
-- RBAC Phase 2 seed (session 201). The roles/role_permissions/user_roles tables
-- (migration 0009) were created but never seeded, so enabling features.rbac was a
-- no-op. Seed the five system roles + permission sets + backfill user_roles. All
-- ON CONFLICT DO NOTHING (idempotent; never clobbers later operator edits).
-- Mirrors packages/server/src/rbac/seed.ts (fresh-install / test path).
INSERT INTO "roles" ("key", "name", "description", "is_system", "priority") VALUES
  ('member', 'Member', 'Default role for every registered user.', true, 10),
  ('pro', 'Pro', 'Pro tier member.', true, 20),
  ('verified', 'Verified', 'Verified member.', true, 30),
  ('staff', 'Staff', 'Moderator: content moderation, contests, events, and reports. No admin panel access.', true, 40),
  ('admin', 'Admin', 'Full administrative access.', true, 50)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", '*' FROM "roles" r WHERE r."key" = 'admin'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key" FROM "roles" r
CROSS JOIN (VALUES
  ('content.read'), ('content.moderate'), ('content.editorial'), ('reports.review'),
  ('contest.create'), ('contest.manage'), ('event.create'), ('event.manage'),
  ('audit.read'), ('users.read')
) AS p("key")
WHERE r."key" = 'staff'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id" FROM "users" u JOIN "roles" r ON r."key" = u."role"::text
ON CONFLICT DO NOTHING;
