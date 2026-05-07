-- Phase 1a foundation for cross-instance delegated authorization.
-- Adds OAuth bearer token storage to federated_accounts so a local
-- session can act on behalf of its linked remote identities. All new
-- columns are nullable or defaulted, so existing rows from the v1 SSO
-- flow keep working unchanged — pre-migration rows just have no token
-- (they continue to be display-only "linked profile" records).
--
-- - access_token_ciphertext: base64-encoded ChaCha20-Poly1305 output
--   (ciphertext || authTag). Plain tokens are NEVER stored at rest.
-- - access_token_iv: base64-encoded 12-byte nonce. Unique per row.
-- - scopes: granted OAuth scopes (e.g., {read,write,follow}).
-- - software_kind: remote AP server kind for client-protocol routing
--   (mastodon, pleroma, gotosocial, akkoma, firefish, cpub, unknown).
--   Detected via WebFinger / OIDC discovery at link time.
-- - revoked_at: soft revocation flag. Set when remote returns 401 or
--   when the user explicitly unlinks. The row is kept for audit.
-- - last_verified_at: timestamp of the most recent successful
--   verify_credentials call. Used to schedule periodic re-verification.
--
-- Encryption key: CPUB_FED_TOKEN_KEY env, 32-byte hex (64 chars).
-- Key rotation runbook: re-encrypt all rows under the new key, then
-- swap the env var atomically. See docs/sessions/136-cross-instance-identity-plan.md.

ALTER TABLE "federated_accounts" ADD COLUMN "access_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD COLUMN "access_token_iv" text;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD COLUMN "scopes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD COLUMN "software_kind" varchar(32) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD COLUMN "last_verified_at" timestamp with time zone;