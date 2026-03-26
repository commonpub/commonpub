# Session 078 — Federation Phase 5: OAuth SSO Across Instances

**Date**: 2026-03-26
**Scope**: @commonpub/server + deveco-io

## What Was Done

### Phase 5 of 7 in the full federation implementation plan.

**Goal**: Instances can authenticate users from other trusted instances via OAuth2 SSO.

### Design: Leveraged Existing Infrastructure
The CommonPub codebase already had extensive OAuth infrastructure:
- `oauthClients` + `oauthCodes` + `federatedAccounts` tables (schema)
- `validateAuthorizeRequest()` + `validateTokenRequest()` with timing-safe comparison (protocol)
- `storeAuthCode()` + `consumeAuthCode()` with 10min TTL, single-use (server)
- `createSSOProviderConfig()` + `discoverOAuthEndpoint()` + `isTrustedInstance()` (auth)
- WebFinger already advertises `oauth_endpoint` link

### New OAuth Module (`federation/oauth.ts`)
**Server-side (Authorization Server):**
- `processAuthorize(db, params, userId, domain)` — validates client, generates auth code, returns redirect info
- `processTokenExchange(db, params, domain)` — validates client+secret, consumes code (single-use), returns access token + user info

**Client-side (Federated Login):**
- `linkFederatedAccount(db, userId, actorUri, instanceDomain, profile?)` — upserts link between local user and remote actor
- `findUserByFederatedAccount(db, actorUri)` — looks up local user by federated actor URI

**Admin:**
- `registerOAuthClient(db, instanceDomain, redirectUris)` — generates client credentials
- `listOAuthClients(db)` — lists registered clients

### deveco-io Routes (7 new)
**OAuth Server:**
- `GET /api/auth/oauth2/authorize` — returns params for consent page
- `POST /api/auth/oauth2/authorize` — processes consent, generates auth code, returns redirect URL
- `POST /api/auth/oauth2/token` — exchanges code for access token + user info

**OAuth Client:**
- `POST /api/auth/federated/login` — initiates federated login (WebFinger discovery → redirect URL)
- `GET /api/auth/federated/callback` — handles redirect back (placeholder for full token exchange)

**Admin:**
- `GET /api/admin/federation/clients` — list registered OAuth clients
- `POST /api/admin/federation/clients` — register new OAuth client

### Frontend
- `pages/auth/oauth/authorize.vue` — OAuth consent screen (approve/deny with client details)

### Tests Added: 13 new
- registerOAuthClient: creates with unique credentials, stored in DB
- processAuthorize: valid request → code, rejects invalid client, rejects invalid redirect_uri, rejects invalid response_type
- processTokenExchange: valid exchange → token + user info, rejects reused code (single-use enforcement), rejects wrong secret, rejects wrong grant_type
- Federated account linking: link, update, find by actor URI, null for unknown

## Security Notes
- Auth codes are single-use (consumed atomically on exchange)
- Client secrets use timing-safe comparison (no timing attacks)
- Trusted instance whitelist enforced before OAuth flow starts
- All routes gated with `requireFeature('federation')`
- Token endpoint doesn't require user auth (standard OAuth2 — server-to-server)
- Consent page requires user auth (only logged-in users can authorize)

## Test Results
- **@commonpub/server**: 33 files, 392 tests (391 passed, 1 skipped)
- **Build**: Clean TypeScript compilation

## Known Limitations (v1)
- Callback handler is a placeholder — full token exchange requires session-based state storage for the remote instance's token endpoint
- Access tokens are stateless UUIDs (no JWT, no introspection endpoint)
- No token refresh flow
- Client registration is admin-only (no dynamic registration)

## Next Steps (Phase 6: Instance Mirroring)
- Instance actor (Service type at /actor)
- instanceMirrors table
- Mirror management: create, pause, cancel
- Content filtering by type/tag
- Anti-loop: originDomain tracking
