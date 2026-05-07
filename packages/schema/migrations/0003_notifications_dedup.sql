-- Notification dedup — closes a flood vector where a malicious user can
-- like → unlike → like a victim's content repeatedly, generating one
-- notification per like. With this UNIQUE index in place, the application's
-- try-INSERT-then-UPDATE-on-23505 path collapses repeated social
-- notifications about the same (user, type, actor, link) tuple to a
-- single row that bumps `read=false` and `created_at = now()`.
--
-- Postgres treats NULLs as distinct in UNIQUE indexes, so system
-- notifications without an actor or link (both NULL) stay non-deduplicated
-- naturally — they each get their own row, which matches existing
-- semantics for system messages.
--
-- Declared as a unique index rather than a table-level UNIQUE constraint
-- so drizzle-kit's pushSchema (used by PGlite-backed tests) applies it.

-- Backfill: any rows accumulated pre-migration from like→unlike→like spam
-- already have duplicates on (user_id, type, actor_id, link). Without this
-- DELETE, `CREATE UNIQUE INDEX` fails with `could not create unique index`
-- and the deploy aborts. Strategy: keep the most recent row per dedup
-- tuple (matches the post-migration semantics where ON-conflict UPDATE
-- bumps `created_at = now()` so the latest row wins). Tie-break on `id`
-- for the rare case where two rows share `created_at` to the millisecond.
DELETE FROM "notifications" a USING "notifications" b
WHERE a.user_id   = b.user_id
  AND a.type      = b.type
  AND a.actor_id  = b.actor_id
  AND a.link      = b.link
  AND a.actor_id IS NOT NULL
  AND a.link     IS NOT NULL
  AND (a.created_at <  b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_user_type_actor_link" ON "notifications" USING btree ("user_id","type","actor_id","link");
