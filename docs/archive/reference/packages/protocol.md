# @commonpub/protocol (Protocol)

> ActivityPub types, activity builders, WebFinger, NodeInfo, OAuth2, HTTP signatures, inbox processing, and content mapping.

**npm**: `@commonpub/protocol`
**Source**: `packages/protocol/src/`
**Entry**: `packages/protocol/src/index.ts`

---

## Exports Overview

| Category | Exports |
|----------|---------|
| Types | `WebFingerResponse`, `WebFingerLink`, `NodeInfoResponse`, `NodeInfoSoftware`, `NodeInfoUsage`, `CommonPubActor`, `ParsedResource` |
| WebFinger | `parseWebFingerResource`, `buildWebFingerResponse` |
| NodeInfo | `buildNodeInfoResponse`, `buildNodeInfoWellKnown` |
| Federation | `createFederation` |
| OAuth | `validateAuthorizeRequest`, `validateTokenRequest` |
| Constants | `AP_CONTEXT`, `AP_PUBLIC` |
| AP Types | `APArticle`, `APNote`, `APTombstone`, `APObject`, `APCreate`, `APUpdate`, `APDelete`, `APFollow`, `APAccept`, `APReject`, `APUndo`, `APLike`, `APAnnounce`, `APActivity`, `APAttachment`, `APTag`, `APOrderedCollection`, `APOrderedCollectionPage` |
| Activity Builders | `buildCreateActivity`, `buildUpdateActivity`, `buildDeleteActivity`, `buildFollowActivity`, `buildAcceptActivity`, `buildRejectActivity`, `buildUndoActivity`, `buildLikeActivity`, `buildAnnounceActivity` |
| Content Mapper | `contentToArticle`, `contentToNote`, `articleToContent`, `noteToComment` |
| Actor Resolution | `validateActorResponse`, `extractInbox`, `extractSharedInbox`, `resolveActor`, `resolveActorViaWebFinger` |
| Keypairs | `generateKeypair`, `exportPublicKeyPem`, `exportPrivateKeyPem`, `buildKeyId`, `verifyHttpSignature` |
| Inbox | `processInboxActivity` |
| Outbox | `generateOutboxCollection`, `generateOutboxPage` |

---

## API Reference

### WebFinger

#### `parseWebFingerResource(resource: string): ParsedResource`

Parses a WebFinger resource string (e.g., `acct:user@domain.com`).

**Returns**: `{ username: string; domain: string }`

**Throws**: If the resource format is invalid.

#### `buildWebFingerResponse(options: BuildWebFingerOptions): WebFingerResponse`

Builds a WebFinger JRD response for an actor.

```typescript
interface BuildWebFingerOptions {
  username: string;
  domain: string;
}
```

**Returns**: JRD document with `subject`, `links` (self, profile page, subscribe template).

---

### NodeInfo

#### `buildNodeInfoWellKnown(domain: string): object`

Builds the `/.well-known/nodeinfo` discovery document.

**Returns**: `{ links: [{ rel, href: "https://{domain}/nodeinfo/2.1" }] }`

#### `buildNodeInfoResponse(options: BuildNodeInfoOptions): NodeInfoResponse`

Builds a NodeInfo 2.1 document.

```typescript
interface BuildNodeInfoOptions {
  domain: string;
  name: string;
  description: string;
  userCount: number;
  postCount: number;
  commentCount: number;
}
```

**Returns**: NodeInfo 2.1 document with software info, protocols (`activitypub`), and usage stats.

---

### Federation

#### `createFederation(options: CreateFederationOptions): FederationHandlers`

Creates the Fedify federation handler bundle.

```typescript
interface CreateFederationOptions {
  domain: string;
  db: DrizzleDB;
  config: CommonPubConfig;
}

interface FederationHandlers {
  // Handler functions for each AP endpoint
}
```

---

### OAuth2

#### `validateAuthorizeRequest(params: URLSearchParams, clients: OAuthClient[]): OAuthAuthorizeRequest | OAuthValidationError`

Validates an incoming OAuth2 authorization request.

**Checks**: `client_id`, `redirect_uri`, `response_type`, `scope`.

#### `validateTokenRequest(body: object, clients: OAuthClient[]): OAuthTokenRequest | OAuthValidationError`

Validates an OAuth2 token exchange request.

**Checks**: `grant_type`, `code`, `client_id`, `client_secret`, `redirect_uri`.

```typescript
interface OAuthAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state?: string;
}

interface OAuthTokenRequest {
  grantType: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  instanceDomain: string;
}

interface OAuthValidationError {
  error: string;
  errorDescription: string;
}
```

---

### Activity Types

#### Constants

```typescript
const AP_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
```

#### Object Types

| Type | TypeScript Type | Maps To |
|------|----------------|---------|
| Article | `APArticle` | project, article, blog, explainer |
| Note | `APNote` | comments, short posts |
| Tombstone | `APTombstone` | deleted content |

#### Activity Types

| Activity | TypeScript Type | Purpose |
|----------|----------------|---------|
| Create | `APCreate` | Publish new content |
| Update | `APUpdate` | Modify existing content |
| Delete | `APDelete` | Remove content |
| Follow | `APFollow` | Follow an actor |
| Accept | `APAccept` | Accept a follow request |
| Reject | `APReject` | Reject a follow request |
| Undo | `APUndo` | Retract a previous activity |
| Like | `APLike` | Like content |
| Announce | `APAnnounce` | Boost/share content |

Union type: `APActivity = APCreate | APUpdate | APDelete | APFollow | APAccept | APReject | APUndo | APLike | APAnnounce`

---

### Activity Builders

All builders return a fully-formed AP activity object with `@context`, unique `id`, `type`, `actor`, and `object`.

#### `buildCreateActivity(domain: string, actorUri: string, object: APObject): APCreate`

Wraps an object in a Create activity.

#### `buildUpdateActivity(domain: string, actorUri: string, object: APObject): APUpdate`

Wraps an object in an Update activity.

#### `buildDeleteActivity(domain: string, actorUri: string, objectId: string, formerType: string): APDelete`

Creates a Delete activity with a Tombstone object.

#### `buildFollowActivity(domain: string, actorUri: string, targetActorUri: string): APFollow`

Creates a Follow activity targeting another actor.

#### `buildAcceptActivity(domain: string, actorUri: string, followActivity: APFollow): APAccept`

Wraps a Follow in an Accept activity.

#### `buildRejectActivity(domain: string, actorUri: string, followActivity: APFollow): APReject`

Wraps a Follow in a Reject activity.

#### `buildUndoActivity(domain: string, actorUri: string, originalActivity: APActivity): APUndo`

Wraps any activity in an Undo (typically used for Undo(Follow)).

#### `buildLikeActivity(domain: string, actorUri: string, objectUri: string): APLike`

Creates a Like activity targeting a content URI.

#### `buildAnnounceActivity(domain: string, actorUri: string, objectUri: string, followersUri: string): APAnnounce`

Creates an Announce (boost) activity.

---

### Content Mapper

#### `contentToArticle(item: ContentItemInput, author: AuthorInput, domain: string): APArticle`

Maps a CommonPub content item to an AP Article.

```typescript
interface ContentItemInput {
  id: string;
  type: string;
  title: string;
  slug: string;
  description?: string;
  content?: unknown;
  publishedAt?: Date;
}

interface AuthorInput {
  username: string;
  displayName?: string;
}
```

#### `contentToNote(comment: CommentInput, author: AuthorInput, domain: string, parentUri?: string): APNote`

Maps a comment to an AP Note.

```typescript
interface CommentInput {
  id: string;
  content: string;
  createdAt: Date;
}
```

#### `articleToContent(article: APArticle): Partial<ContentItemInput>`

Maps an AP Article back to a content item shape (for inbound processing).

#### `noteToComment(note: APNote): Partial<CommentInput>`

Maps an AP Note back to a comment shape.

---

### Actor Resolution

#### `resolveActor(actorUri: string, fetchFn?: FetchFn): Promise<ResolvedActor>`

Fetches and validates a remote actor profile by URI.

```typescript
interface ResolvedActor {
  id: string;
  type: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox?: string;
  publicKey?: { id: string; publicKeyPem: string };
  endpoints?: { sharedInbox?: string };
}

type FetchFn = typeof fetch;
```

#### `resolveActorViaWebFinger(handle: string, fetchFn?: FetchFn): Promise<ResolvedActor>`

Resolves an actor via WebFinger lookup first, then fetches the actor profile.

**Input**: `@user@domain.com` or `user@domain.com`

#### `validateActorResponse(data: unknown): ResolvedActor`

Validates that a JSON object is a valid AP actor.

#### `extractInbox(actor: ResolvedActor): string`

Returns the actor's inbox URL.

#### `extractSharedInbox(actor: ResolvedActor): string | undefined`

Returns the actor's shared inbox URL if available.

---

### Keypair Management

#### `generateKeypair(): Promise<ActorKeypair>`

Generates an RSA-2048 keypair for HTTP Signature signing.

```typescript
interface ActorKeypair {
  publicKeyPem: string;
  privateKeyPem: string;
}
```

#### `exportPublicKeyPem(keypair: CryptoKeyPair): Promise<string>`

Exports the public key as PEM.

#### `exportPrivateKeyPem(keypair: CryptoKeyPair): Promise<string>`

Exports the private key as PEM.

#### `buildKeyId(actorUri: string): string`

Returns `{actorUri}#main-key`.

#### `verifyHttpSignature(request: Request, publicKeyPem: string): Promise<boolean>`

Verifies an HTTP Signature on an incoming request against a public key.

---

### Inbox Processing

#### `processInboxActivity(activity: APActivity, callbacks: InboxCallbacks): Promise<InboxResult>`

Routes an incoming activity to the appropriate callback handler.

```typescript
interface InboxCallbacks {
  onFollow?: (activity: APFollow) => Promise<void>;
  onAccept?: (activity: APAccept) => Promise<void>;
  onReject?: (activity: APReject) => Promise<void>;
  onUndo?: (activity: APUndo) => Promise<void>;
  onCreate?: (activity: APCreate) => Promise<void>;
  onUpdate?: (activity: APUpdate) => Promise<void>;
  onDelete?: (activity: APDelete) => Promise<void>;
  onLike?: (activity: APLike) => Promise<void>;
  onAnnounce?: (activity: APAnnounce) => Promise<void>;
}

interface InboxResult {
  handled: boolean;
  type: string;
  error?: string;
}
```

---

### Outbox

#### `generateOutboxCollection(actorUri: string, totalItems: number): APOrderedCollection`

Creates an OrderedCollection pointing to paginated outbox pages.

#### `generateOutboxPage(actorUri: string, activities: APActivity[], page: number, totalItems: number): APOrderedCollectionPage`

Creates a single page of the outbox (20 items per page).

---

## Internal Architecture

```
packages/protocol/src/
├── index.ts           → All exports
├── types.ts           → WebFinger, NodeInfo, Actor types
├── webfinger.ts       → parseWebFingerResource, buildWebFingerResponse
├── nodeinfo.ts        → buildNodeInfoResponse, buildNodeInfoWellKnown
├── federation.ts      → createFederation (Fedify setup)
├── oauth.ts           → validateAuthorizeRequest, validateTokenRequest
├── activityTypes.ts   → AP_CONTEXT, AP_PUBLIC, all APActivity type definitions
├── activities.ts      → 9 activity builder functions
├── contentMapper.ts   → contentToArticle, contentToNote, articleToContent, noteToComment
├── actorResolver.ts   → resolveActor, resolveActorViaWebFinger, validation
├── keypairs.ts        → generateKeypair, HTTP Signature verification
├── inbox.ts           → processInboxActivity
└── outbox.ts          → generateOutboxCollection, generateOutboxPage
```
