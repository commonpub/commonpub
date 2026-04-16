# Hub Server Module

> 30+ functions for hub CRUD, membership, posts, replies, moderation, invites, and content sharing. Hubs are local-only in v1 (no AP Group federation).

**Source**: `packages/server/src/hub.ts`
**API routes**: `apps/reference/server/api/hubs/`

---

## Hub Types

Hubs serve as the umbrella concept with three typed variants:

| Type | Purpose | Examples |
|------|---------|----------|
| `community` | Maker group / topic space | "Edge AI Builders", "FPGA Enthusiasts" |
| `product` | Product/platform page | "Arduino Nano 33 BLE", "TensorFlow Lite" |
| `company` | Organization page | "Arduino", "Adafruit", "SparkFun" |

---

## Exports

| Category | Functions |
|----------|-----------|
| CRUD | `listHubs`, `getHubBySlug`, `createHub`, `updateHub`, `deleteHub` |
| Membership | `joinHub`, `leaveHub`, `getMember`, `listMembers`, `changeRole`, `kickMember` |
| Posts | `createPost`, `listPosts`, `deletePost`, `togglePinPost`, `toggleLockPost` |
| Replies | `createReply`, `listReplies`, `deleteReply` |
| Moderation | `banUser`, `unbanUser`, `checkBan`, `listBans` |
| Invites | `createInvite`, `validateAndUseInvite`, `revokeInvite`, `listInvites` |
| Content Sharing | `shareContent`, `unshareContent`, `listShares` |
| Gallery | `listHubGallery` |
| Products | `listHubProducts`, `addHubProduct` |

All functions are async and accept `db: DB` as their first parameter.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hubs` | List hubs (paginated, filterable) |
| POST | `/api/hubs` | Create hub |
| GET | `/api/hubs/:slug` | Get hub detail |
| PUT | `/api/hubs/:slug` | Update hub (owner/admin) |
| DELETE | `/api/hubs/:slug` | Delete hub (owner only) |
| POST | `/api/hubs/:slug/join` | Join hub |
| POST | `/api/hubs/:slug/leave` | Leave hub |
| GET | `/api/hubs/:slug/members` | List members |
| PUT | `/api/hubs/:slug/members/:userId` | Change member role |
| DELETE | `/api/hubs/:slug/members/:userId` | Kick member |
| GET | `/api/hubs/:slug/posts` | List posts (filterable by type) |
| POST | `/api/hubs/:slug/posts` | Create post |
| DELETE | `/api/hubs/:slug/posts/:postId` | Delete post |
| GET | `/api/hubs/:slug/posts/:postId/replies` | List replies |
| POST | `/api/hubs/:slug/posts/:postId/replies` | Create reply |
| GET | `/api/hubs/:slug/bans` | List bans |
| POST | `/api/hubs/:slug/bans` | Ban user |
| DELETE | `/api/hubs/:slug/bans/:userId` | Unban user |
| GET | `/api/hubs/:slug/invites` | List invites |
| POST | `/api/hubs/:slug/invites` | Create invite |
| GET | `/api/hubs/:slug/gallery` | Hub content gallery |
| GET | `/api/hubs/:slug/products` | Hub products |
| POST | `/api/hubs/:slug/products` | Add product to hub |
| POST | `/api/hubs/:slug/share` | Share content to hub |
| GET | `/api/hubs/:slug/feed.xml` | Hub RSS feed |

---

## Join Policy

Join behavior depends on the hub's `joinPolicy`:

- **open** — User is added immediately
- **approval** — Creates a pending membership request
- **invite** — Rejected unless the user holds a valid invite

Throws if the user is banned.

## Membership Roles

Role hierarchy: `owner` > `admin` > `moderator` > `member`. A user can only assign roles below their own.

## Gallery Queries

Gallery content varies by hub type:
- **Community hubs**: Content from `hubShares` table
- **Product hubs**: Content from `contentProducts` where `product.hubId = hubId`
- **Company hubs**: Content from `contentProducts` where product belongs to any child hub
