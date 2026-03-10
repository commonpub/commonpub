# AP Actor SSO Flow (Model B) Research

## Overview

Model B allows users to authenticate on Instance B using their Instance A identity, without sharing a database. This uses standard OAuth2 with WebFinger discovery.

## Flow: User signs in to Instance B with Instance A identity

### 1. Initiate SSO

User visits Instance B → clicks "Sign in with Instance A"

### 2. WebFinger Discovery

Instance B performs WebFinger lookup:

```
GET https://instance-a.example/.well-known/webfinger?resource=acct:user@instance-a.example
```

Response (JRD format):

```json
{
  "subject": "acct:user@instance-a.example",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://instance-a.example/users/alice"
    },
    {
      "rel": "http://openid.net/specs/connect/1.0/issuer",
      "href": "https://instance-a.example"
    },
    {
      "rel": "oauth_endpoint",
      "href": "https://instance-a.example/api/auth/oauth2/authorize"
    }
  ]
}
```

### 3. OAuth2 Authorization

Instance B redirects user to Instance A's authorization endpoint:

```
GET https://instance-a.example/api/auth/oauth2/authorize
  ?client_id=instance-b-client-id
  &redirect_uri=https://instance-b.example/api/auth/callback/snaplify-sso
  &response_type=code
  &scope=openid profile
  &state=random-state
```

### 4. User Authenticates on Instance A

User logs in (or is already logged in) on Instance A. Instance A shows consent screen.

### 5. Authorization Code Redirect

Instance A redirects back to Instance B with authorization code:

```
GET https://instance-b.example/api/auth/callback/snaplify-sso
  ?code=authorization-code
  &state=random-state
```

### 6. Token Exchange

Instance B exchanges code for tokens:

```
POST https://instance-a.example/api/auth/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=authorization-code
&client_id=instance-b-client-id
&client_secret=instance-b-client-secret
&redirect_uri=https://instance-b.example/api/auth/callback/snaplify-sso
```

Response:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {
    "id": "uuid",
    "email": "user@instance-a.example",
    "username": "alice",
    "display_name": "Alice",
    "avatar_url": "https://..."
  }
}
```

### 7. Federated Account Creation

Instance B creates a `federatedAccounts` record linking the local user to the remote actor:

```
federatedAccounts: {
  userId: local-user-id,
  actorUri: "https://instance-a.example/users/alice",
  instanceDomain: "instance-a.example",
  preferredUsername: "alice",
  displayName: "Alice",
  avatarUrl: "https://...",
  lastSyncedAt: now()
}
```

## Implementation with Better Auth

### Provider Side (Instance A)

Uses Better Auth's `oauthProvider` plugin to serve as an OAuth2 provider:
- Registers Instance B as an `oauthClients` record
- Serves `/api/auth/oauth2/authorize` and `/api/auth/oauth2/token` endpoints

### Consumer Side (Instance B)

Uses Better Auth's `genericOAuth` plugin to consume SSO:
- Configured with discovered OAuth endpoint from WebFinger
- Creates local user + `federatedAccounts` record on successful auth

## Trust Model

- Instances must be in each other's `trustedInstances` config
- `oauthClients` table stores registered client credentials
- Federation feature flag must be `true`
