# @commonpub/protocol

ActivityPub federation protocol implementation for CommonPub.

## Overview

Implements the ActivityPub protocol layer: WebFinger discovery, NodeInfo, activity building and processing, content mapping, actor resolution, keypair management, and inbox/outbox handling. Wraps the [Fedify](https://fedify.dev/) framework with CommonPub-specific types.

## Installation

```bash
pnpm add @commonpub/protocol
```

## Usage

### WebFinger Discovery

```ts
import { parseWebFingerResource, buildWebFingerResponse } from '@commonpub/protocol';

// Parse an acct: URI
const parsed = parseWebFingerResource('acct:alice@hack.build');
// { username: 'alice', domain: 'hack.build' }

// Build a WebFinger response
const response = buildWebFingerResponse({
  subject: 'acct:alice@hack.build',
  actorUrl: 'https://hack.build/users/alice',
  profileUrl: 'https://hack.build/@alice',
});
```

### NodeInfo

```ts
import { buildNodeInfoResponse, buildNodeInfoWellKnown } from '@commonpub/protocol';

const nodeInfo = buildNodeInfoResponse({
  domain: 'hack.build',
  name: 'hack.build',
  description: 'A maker community',
  totalUsers: 42,
  activeMonth: 15,
  localPosts: 128,
});
```

### Building Activities

```ts
import {
  buildCreateActivity,
  buildFollowActivity,
  buildLikeActivity,
  buildAnnounceActivity,
} from '@commonpub/protocol';

// Create a new article
const create = buildCreateActivity({
  actorId: 'https://hack.build/users/alice',
  object: article,
});

// Follow an actor
const follow = buildFollowActivity({
  actorId: 'https://hack.build/users/alice',
  targetId: 'https://deveco.io/users/bob',
});
```

### Content Mapping

Bidirectional mapping between CommonPub content and AP objects:

```ts
import { contentToArticle, articleToContent, contentToNote, noteToComment } from '@commonpub/protocol';

// CommonPub content -> AP Article
const article = contentToArticle(contentItem, author);

// AP Article -> CommonPub content
const content = articleToContent(apArticle);
```

### Actor Resolution

```ts
import { resolveActor, resolveActorViaWebFinger } from '@commonpub/protocol';

// Resolve by actor URL
const actor = await resolveActor('https://deveco.io/users/bob');

// Resolve via WebFinger
const actor = await resolveActorViaWebFinger('bob@deveco.io');
```

### Keypair Management

RSA 2048 keypairs for HTTP signatures:

```ts
import { generateKeypair, exportPublicKeyPem, buildKeyId } from '@commonpub/protocol';

const keypair = await generateKeypair();
const publicPem = await exportPublicKeyPem(keypair.publicKey);
const keyId = buildKeyId('https://hack.build/users/alice');
```

### Inbox Processing

```ts
import { processInboxActivity } from '@commonpub/protocol';

const result = await processInboxActivity(activity, {
  onFollow: async (follower, target) => { /* ... */ },
  onLike: async (actor, object) => { /* ... */ },
  onAnnounce: async (actor, object) => { /* ... */ },
  // ... handlers for all 9 activity types
});
```

## Supported Activity Types

| Activity   | Direction | Description                        |
| ---------- | --------- | ---------------------------------- |
| `Create`   | Out/In    | New content published              |
| `Update`   | Out/In    | Content edited                     |
| `Delete`   | Out/In    | Content removed (Tombstone)        |
| `Follow`   | Out/In    | Follow request                     |
| `Accept`   | Out/In    | Follow request accepted            |
| `Reject`   | Out/In    | Follow request rejected            |
| `Undo`     | Out/In    | Undo a previous activity           |
| `Like`     | Out/In    | Content liked                      |
| `Announce` | Out/In    | Content shared/boosted             |

## AP Object Types

- `APArticle`: Long-form content (projects, articles, guides)
- `APNote`: Short-form content (comments, replies)
- `APTombstone`: Deleted content marker

## OAuth2 SSO

OAuth2 authorization and token validation for cross-instance SSO:

```ts
import { validateAuthorizeRequest, validateTokenRequest } from '@commonpub/protocol';
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 42 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `jose`: JWT and JWK operations
- `zod`: Input validation
- `@commonpub/config`: Feature flags
- `@commonpub/schema`: Table definitions for federation state
