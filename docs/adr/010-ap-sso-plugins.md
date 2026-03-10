# ADR 010: AP Actor SSO via Better Auth Plugins

## Status

Accepted

## Context

Snaplify instances need to authenticate users across instances (Model B: AP Actor SSO) without sharing a database. The standard approach is OAuth2 with WebFinger discovery.

## Decision

Use Better Auth's plugin ecosystem for both sides of the SSO flow:

**Provider side** (Instance A serves as OAuth provider):
- The auth handler at `/api/auth/oauth2/authorize` and `/api/auth/oauth2/token` serves OAuth2 flows
- Registered OAuth clients stored in `oauthClients` table
- WebFinger responses include `oauth_endpoint` link for discovery

**Consumer side** (Instance B uses SSO from Instance A):
- WebFinger discovery finds the OAuth endpoint on the remote instance
- Standard OAuth2 authorization code flow
- On successful auth, creates a `federatedAccounts` record linking local user to remote actor

**Trust model**:
- Both instances must list each other in `config.auth.trustedInstances`
- Federation feature flag must be enabled (`config.features.federation = true`)
- OAuth client registration is required before SSO works

## Flow

1. Instance B performs WebFinger lookup on Instance A
2. Discovers `oauth_endpoint` from JRD response
3. Redirects user to Instance A's authorization endpoint
4. User authenticates on Instance A
5. Instance A returns authorization code
6. Instance B exchanges code for token
7. Instance B creates local user + `federatedAccounts` record

## Consequences

- No custom OAuth2 server implementation needed — leverages Better Auth
- WebFinger is the standard discovery mechanism, compatible with other AP implementations
- OAuth2 validators (`validateAuthorizeRequest`, `validateTokenRequest`) provide security checks before processing
- The `federation` feature flag defaults to `false` — SSO is opt-in
- Trust is explicit and bidirectional
