# Federation Guide

> v1 capabilities and limitations, OAuth2 SSO flow, endpoint reference, and answers to cross-publishing/mirroring questions.

---

## What Federation DOES Enable in v1

1. **Follow users across instances** — Mutual follow with Accept/Reject lifecycle
2. **See federated content** — When someone you follow publishes, a Create activity is logged
3. **Like content across instances** — Like activities are sent outbound
4. **Single sign-on** — OAuth2 SSO between trusted instances (Model B)
5. **Discover users** — WebFinger lookup (`@user@instance.com`)
6. **Actor profiles** — JSON-LD actor documents with public keys
7. **NodeInfo** — Instance metadata discovery

## What Federation Does NOT Enable in v1

1. **No remote content persistence** — Inbound Create/Update/Delete/Like/Announce are logged but NOT stored locally
2. **No cross-publishing** — Content has a single origin instance
3. **No server mirroring** — No content sync between instances
4. **No federated hubs** — Hubs are local-only (standing rule #5)
5. **No cross-instance hub interaction** — Cannot join or post in remote hubs
6. **No activity delivery** — Activities are logged in the `activities` table but not yet delivered to remote inboxes via HTTP
7. **No HTTP Signature signing on outbound requests** — Verification of inbound signatures is implemented

---

## FAQ: Cross-Publishing, Mirroring, and Cross-Site Interaction

### Can hubs mirror projects from another site?

**No.** Hubs are local-only in v1 (standing rule #5). There is no AP Group support and no remote content persistence. Inbound Create/Update/Delete activities are stub handlers that log the activity but do not store the content locally.

### Can I publish projects to multiple sites?

**No.** Content has a single origin instance. Federation is outbound-only: when you publish locally, a Create activity (AP Article) is logged. There is no cross-posting or multi-origin storage mechanism.

### Can I interact with hubs from different sites?

**No.** Hubs are local to each instance. Users can follow remote *users* and like federated *content*, but cannot join or post in remote hubs.

### Can I at server level say "this server mirrors that one"?

**No.** No mirroring feature exists. Inbound content is logged but not stored. Remote actor profiles are cached (24h TTL) in the `remoteActors` table, but content is not persisted.

### Can I OAuth with one site and cross-publish?

**Partially.** OAuth2 SSO (Model B) lets you authenticate on Instance A and create a linked account on Instance B via the `federatedAccounts` table. But this only creates an identity link — it does NOT enable cross-publishing. Each instance maintains its own content independently.

### What would need to be built for full federation?

These are all post-v1.0.0 features requiring significant protocol work:

1. **AP Group support** — For federated communities (`type: "Group"`)
2. **Inbound content persistence** — Store remote Articles/Notes locally
3. **Activity delivery** — Actually deliver outbound activities to remote inboxes via signed HTTP POST
4. **Cross-publishing API** — Publish to multiple origin instances
5. **Server mirroring protocol** — Full content sync between instances
6. **HTTP Signature signing** — Sign outbound requests with actor keypairs

---

## Federation Architecture

### Supported Activity Types (9)

| Activity | Direction | Implementation |
|----------|-----------|---------------|
| **Create** | Outbound | `federateContent()` → logged in activities table |
| **Create** | Inbound | `onCreate` callback → log only (stub) |
| **Update** | Outbound | `federateUpdate()` → logged |
| **Update** | Inbound | `onUpdate` callback → log only (stub) |
| **Delete** | Outbound | `federateDelete()` → logged |
| **Delete** | Inbound | `onDelete` callback → log only (stub) |
| **Follow** | Both | Full lifecycle: pending → accepted/rejected |
| **Accept** | Both | Updates followRelationship status |
| **Reject** | Both | Updates followRelationship status |
| **Undo** | Both | Deletes followRelationship (for Follow) |
| **Like** | Outbound | `federateLike()` → logged |
| **Like** | Inbound | `onLike` callback → log only (stub) |
| **Announce** | Inbound | `onAnnounce` callback → log only (stub) |

### Object Types

| AP Type | CommonPub Type | Builder |
|---------|--------------|---------|
| Article | project, article, blog, explainer | `contentToArticle(item, author, domain)` |
| Note | comment, short post | `contentToNote(comment, author, domain, parentUri)` |
| Tombstone | deleted content | Via Delete activity |

### Actor Shape (Person)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Person",
  "id": "https://hack.build/users/alice",
  "preferredUsername": "alice",
  "name": "Alice",
  "summary": "Maker and hacker",
  "url": "https://hack.build/@alice",
  "inbox": "https://hack.build/users/alice/inbox",
  "outbox": "https://hack.build/users/alice/outbox",
  "followers": "https://hack.build/users/alice/followers",
  "following": "https://hack.build/users/alice/following",
  "publicKey": {
    "id": "https://hack.build/users/alice#main-key",
    "owner": "https://hack.build/users/alice",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  },
  "endpoints": {
    "sharedInbox": "https://hack.build/inbox",
    "oauthAuthorizationEndpoint": "https://hack.build/api/auth/oauth2/authorize",
    "oauthTokenEndpoint": "https://hack.build/api/auth/oauth2/token"
  }
}
```

### Activity Example (Create Article)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://hack.build/activities/uuid",
  "actor": "https://hack.build/users/alice",
  "object": {
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Article",
    "id": "https://hack.build/u/alice/project/my-robot",
    "attributedTo": "https://hack.build/users/alice",
    "name": "Building a Robot Arm",
    "content": "<p>Step by step guide...</p>",
    "url": "https://hack.build/u/alice/project/my-robot",
    "published": "2026-03-10T00:00:00Z",
    "to": ["https://www.w3.org/ns/activitystreams#Public"],
    "cc": ["https://hack.build/users/alice/followers"]
  },
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://hack.build/users/alice/followers"]
}
```

---

## Federation Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/webfinger?resource=acct:{user}@{domain}` | GET | WebFinger discovery |
| `/.well-known/nodeinfo` | GET | NodeInfo discovery |
| `/nodeinfo/2.1` | GET | NodeInfo 2.1 document |
| `/users/[username]` | GET | Actor profile (content negotiation: `application/activity+json`) |
| `/users/[username]/followers` | GET | Followers OrderedCollection |
| `/users/[username]/following` | GET | Following OrderedCollection |
| `/users/[username]/outbox` | GET | Outbox (paginated, 20/page) |
| `/users/[username]/inbox` | POST | Per-user inbox (processes 9 activity types) |
| `/inbox` | POST | Shared inbox |

### Internal API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/federation/follow` | POST | Send follow `{remoteActorUri}` | Yes |
| `/api/federation/follow/[id]` | DELETE | Unfollow | Yes |
| `/api/federation/follow/[id]/accept` | POST | Accept follow request | Yes |
| `/api/federation/follow/[id]/reject` | POST | Reject follow request | Yes |

---

## OAuth2 SSO Flow (Model B)

```mermaid
sequenceDiagram
    participant User as User on Instance B
    participant B as Instance B
    participant A as Instance A

    User->>B: "Login with Instance A"
    B->>A: WebFinger: /.well-known/webfinger?resource=acct:@{domain_a}
    A-->>B: Returns oauth endpoints
    B->>A: Redirect to /api/auth/oauth2/authorize?client_id=...&redirect_uri=...
    A->>User: Show login form (if not logged in)
    User->>A: Authenticate
    A->>A: storeAuthCode(code, userId, clientId, redirectUri)
    A-->>B: Redirect to callback with ?code=...
    B->>A: POST /api/auth/oauth2/token (code, client_id, client_secret)
    A->>A: consumeAuthCode(code, clientId, redirectUri) — single-use, 10-min TTL
    A-->>B: Returns access_token + user info
    B->>B: Create/link local account via federatedAccounts table
    B-->>User: Logged in!
```

### OAuth2 Setup

1. Register Instance B as an OAuth client on Instance A (creates `oauthClients` row)
2. Add Instance A's domain to Instance B's `auth.trustedInstances[]` config
3. User on Instance B clicks "Login with Instance A"
4. Standard OAuth2 authorization code flow with PKCE

### SSO Limitations

- Only creates an identity link — does NOT sync content
- Requires pre-registration of OAuth clients (manual process)
- Auth codes are in-memory (production should use Redis)
- No automatic account provisioning (user must complete signup on Instance B)

---

## Database Tables Used by Federation

| Table | Purpose |
|-------|---------|
| `remoteActors` | Cache of remote AP actor profiles (24h TTL) |
| `activities` | Log of all inbound/outbound AP activities |
| `followRelationships` | Federation-level follow state (pending/accepted/rejected) |
| `actorKeypairs` | RSA-2048 keypairs per user for HTTP Signatures |
| `federatedAccounts` | Links local users to remote AP actor identities |
| `oauthClients` | Registered OAuth2 clients (other CommonPub instances) |

---

## Inbox Processing

When an activity arrives at `/users/[username]/inbox` or `/inbox`:

1. Parse the JSON-LD activity body
2. Route to the appropriate `InboxCallbacks` handler based on `activity.type`
3. For Follow/Accept/Reject/Undo: Full implementation — updates `followRelationships` table
4. For Create/Update/Delete/Like/Announce: **Stub implementation** — logs the activity to the `activities` table with status `'processed'` but does NOT persist the content locally

```typescript
// v1 inbox callbacks
{
  onFollow: async (activity) => {
    // Insert followRelationship (pending), auto-accept in v1
  },
  onAccept: async (activity) => {
    // Update followRelationship → accepted
  },
  onReject: async (activity) => {
    // Update followRelationship → rejected
  },
  onUndo: async (activity) => {
    // Delete followRelationship (if Follow)
  },
  onCreate: async (activity) => {
    // LOG ONLY — does not store remote content
  },
  onUpdate: async (activity) => {
    // LOG ONLY
  },
  onDelete: async (activity) => {
    // LOG ONLY
  },
  onLike: async (activity) => {
    // LOG ONLY
  },
  onAnnounce: async (activity) => {
    // LOG ONLY
  },
}
```

---

## Federation Hook Pattern

Server modules call federation functions after mutations when the federation flag is enabled:

```typescript
// In content.ts
export async function onContentPublished(db, contentId, config) {
  if (!config.features.federation) return;
  await federateContent(db, contentId, config.instance.domain)
    .catch((err: unknown) => { console.error('[federation]', err); });
}
```

Key points:
- Always check `config.features.federation` first
- Always `.catch(...)` with `console.error` — federation failures must never break local operations, but errors are logged for observability
- Activities are logged to the `activities` table with status `'pending'`
- No actual HTTP delivery happens in v1 (activities remain in pending state)

---

## Federation Roadmap (Post-v1)

> **Superseded**: The detailed F1–F8 roadmap below has been expanded into a comprehensive 10-phase plan at `docs/federation-plan.md`. That document includes full schema designs, implementation details, CommonPub namespace specification, and architectural decisions. The summary below is preserved for quick reference.

| Phase | What | Enables | Depends On | Complexity |
|-------|------|---------|------------|------------|
| 1 | Outbound Delivery (F1+F2 merged) | Activities arrive at remote inboxes | — | Medium |
| 2 | Inbound Content Persistence | Remote content in local feeds | Phase 1 | Medium |
| 3 | Cross-Instance Interaction | Like/comment on remote content | Phases 1–2 | Medium |
| 4 | OAuth2 Consumer | Complete SSO both directions | — | Small |
| 5 | CommonPub Namespace | Rich content types over AP (BOM, products, learning) | — | Medium |
| 6 | Hub Federation (Groups) | Federated hubs via FEP-1b12 | Phases 1–5 | Large |
| 7 | Content Mirroring | Instance-level content sync | Phases 1–3 | Large |
| 8 | BOM Federation | Cross-instance product galleries | Phase 6 | Medium |
| 9 | Selective Federation | Granular admin controls | Phases 1–3 | Medium |
| 10 | Relay & Discovery | Topic-aware content distribution | Phases 1–6 | Medium |

**See `docs/federation-plan.md` for complete details, schema designs, and implementation guides.**

### Detailed Phase Documentation

Full implementation details for each phase — including schema SQL, function signatures, API endpoints, tests, and architectural decisions — are in `docs/federation-plan.md`.

Key highlights:
- **Phase 5 (CommonPub Namespace)**: Defines `https://commonpub.org/ns/v1#` with custom properties for BOMs, product specs, learning paths, and docs. All objects degrade gracefully to standard Article/Note for non-CommonPub servers.
- **Phase 6 (Hub Federation)**: Uses FEP-1b12 Announce pattern (proven by Lemmy). Hubs become Group actors with their own keypairs. Content posted to hubs is wrapped in Announce and delivered to all followers.
- **Phase 8 (BOM Federation)**: When a project's BOM references a product on another instance, the product gallery updates cross-instance. Unique to CommonPub.

Research notes, open questions, and decision rationale are in `docs/federation-notes.md`.
