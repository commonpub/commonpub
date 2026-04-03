-- Backfill federated_hub_members from existing federated_hub_posts.
-- Run AFTER drizzle-kit push creates the federated_hub_members table.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).
--
-- Run on both instances:
--   commonpub.io: docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -f /path/to/this.sql
--   deveco.io:    psql $NUXT_DATABASE_URL -f /path/to/this.sql

INSERT INTO federated_hub_members (id, federated_hub_id, remote_actor_id, discovered_via, joined_at)
SELECT
  gen_random_uuid(),
  fhp.federated_hub_id,
  fhp.remote_actor_id,
  'post',
  MIN(fhp.received_at)
FROM federated_hub_posts fhp
WHERE fhp.remote_actor_id IS NOT NULL
  AND fhp.deleted_at IS NULL
GROUP BY fhp.federated_hub_id, fhp.remote_actor_id
ON CONFLICT (federated_hub_id, remote_actor_id) DO NOTHING;
